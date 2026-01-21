const moment = require("moment");
const { QueryTypes } = require("sequelize");
const { sequelize } = require("../openmrs_models");
const { logStream } = require("../logger/index");

/**
 * Parse NCD screening data from CURRENT COMPLAINT observation text
 * @param {string} complaintText - The HTML formatted text from CURRENT_COMPLAINT observation
 * @returns {Object} - Parsed NCD values {rbs, hemoglobin, systolicBP, diastolicBP}
 */
function parseNCDScreeningFromComplaint(complaintText) {
  if (!complaintText || typeof complaintText !== 'string') {
    return { rbs: null, hemoglobin: null, systolicBP: null, diastolicBP: null };
  }

  const result = { rbs: null, hemoglobin: null, systolicBP: null, diastolicBP: null };

  try {
    // Parse Random Blood Sugar
    const rbsPatterns = [
      /Random Blood Sugar\(mg\/dL\)\s*-\s*(\d+(?:\.\d+)?)/i,
      /Random Blood Sugar\(mg\/dL\)[^<]*?(\d+(?:\.\d+)?)\s*<br/i,
      /Random Blood Sugar\s*-\s*(\d+(?:\.\d+)?)/i,
      /RBS\s*-\s*(\d+(?:\.\d+)?)/i
    ];

    for (const pattern of rbsPatterns) {
      const match = complaintText.match(pattern);
      if (match?.[1]) {
        result.rbs = parseFloat(match[1]);
        break;
      }
    }

    // Parse Haemoglobin
    const hbPatterns = [
      /H[ae]moglobin\(Hb\)\s*Measurement\s*-\s*(\d+(?:\.\d+)?)/i,
      /H[ae]moglobin\(gm\/dL\)\s*-\s*(\d+(?:\.\d+)?)/i,
      /H[ae]moglobin\(gm\/dL\)[^<]*?(\d+(?:\.\d+)?)\s*<br/i,
      /H[ae]moglobin\s*-\s*(\d+(?:\.\d+)?)/i,
      /HB\s*-\s*(\d+(?:\.\d+)?)/i
    ];

    for (const pattern of hbPatterns) {
      const match = complaintText.match(pattern);
      if (match?.[1]) {
        result.hemoglobin = parseFloat(match[1]);
        break;
      }
    }

    // Parse Blood Pressure (extract last BP value if multiple exist)
    const bpPattern = /BP\s*Measurement\s*-\s*(\d+)\/(\d+)/gi;
    let bpMatch;
    while ((bpMatch = bpPattern.exec(complaintText)) !== null) {
      result.systolicBP = parseInt(bpMatch[1]);
      result.diastolicBP = parseInt(bpMatch[2]);
    }
  } catch (error) {
    // Silent fail - return partial results
  }

  return result;
}

module.exports = (function () {
  /**
   * Get last 7 NCD visits for a patient with vitals data
   * When multiple readings exist for the same vital in a visit, picks the latest (most recent) one
   * @param {string} patientUuid - Patient UUID
   * @returns {Promise<Object>} Patient demographics and visit vitals
   */
  this.getNcdReportData = async (patientUuid) => {
    try {
      logStream("debug", "NCD Report Service", "Get NCD Report Data");

      // Get patient demographics and NCD visits in parallel
      const [personResult, ncdVisits] = await Promise.all([
        sequelize.query(
          `SELECT
            p.person_id, p.uuid, p.gender, p.birthdate,
            pn.given_name, pn.family_name, pn.middle_name,
            pi.identifier
           FROM person p
           LEFT JOIN person_name pn ON p.person_id = pn.person_id AND pn.voided = 0 AND pn.preferred = 1
           LEFT JOIN patient_identifier pi ON p.person_id = pi.patient_id AND pi.voided = 0 AND pi.preferred = 1
           WHERE p.uuid = :patientUuid AND p.voided = 0
           LIMIT 1`,
          { replacements: { patientUuid }, type: QueryTypes.SELECT }
        ),
        sequelize.query(
          `SELECT v.uuid as visit_uuid, v.date_started, MAX(o.value_text) as complaint_text
           FROM visit v
           INNER JOIN visit_attribute va ON v.visit_id = va.visit_id
           INNER JOIN visit_attribute_type vat ON va.attribute_type_id = vat.visit_attribute_type_id
           INNER JOIN encounter e ON v.visit_id = e.visit_id
           INNER JOIN obs o ON e.encounter_id = o.encounter_id
           INNER JOIN person p ON v.patient_id = p.person_id
           WHERE p.uuid = :patientUuid
             AND v.voided = 0
             AND v.date_stopped IS NOT NULL
             AND vat.uuid = 'bc79d2ab-3c83-48f2-820d-08a02b32faab'
             AND va.voided = 0
             AND o.concept_id = 163212
             AND o.voided = 0
             AND e.voided = 0
             AND o.value_text IS NOT NULL
             AND o.value_text != ''
           GROUP BY v.visit_id, v.uuid, v.date_started
           ORDER BY v.date_started DESC
           LIMIT 7`,
          { replacements: { patientUuid }, type: QueryTypes.SELECT }
        )
      ]);

      if (!personResult || personResult.length === 0) {
        throw new Error("Patient not found");
      }

      const patient = personResult[0];
      const age = patient.birthdate ? moment().diff(moment(patient.birthdate), "years") : null;

      // Process NCD visits
      const visitVitals = ncdVisits.map((visit) => {
        const ncdData = parseNCDScreeningFromComplaint(visit.complaint_text);
        const visitDate = moment(visit.date_started).format("DD MMM, YY");

        return {
          visitUuid: visit.visit_uuid,
          visitDate,
          visitDateTime: moment(visit.date_started).format("DD MMM, YY HH:mm"),
          systolicBP: ncdData.systolicBP,
          diastolicBP: ncdData.diastolicBP,
          bloodPressure: ncdData.systolicBP ? `${ncdData.systolicBP}/${ncdData.diastolicBP}` : null,
          bloodSugar: ncdData.rbs,
          hemoglobin: ncdData.hemoglobin,
          hgb: ncdData.hemoglobin !== null ? ncdData.hemoglobin : 'N/A',
          rbs: ncdData.rbs !== null ? ncdData.rbs : 'N/A',
          bp: ncdData.systolicBP ? `${ncdData.systolicBP}/${ncdData.diastolicBP}` : 'N/A',
          date: visitDate
        };
      });

      const formattedName = [patient.given_name, patient.middle_name, patient.family_name]
        .filter(Boolean)
        .join(" ") || "N/A";

      logStream("debug", "Success", "Get NCD Report Data");
      return {
        patient: {
          uuid: patient.uuid,
          identifier: patient.identifier || "N/A",
          name: formattedName,
          gender: patient.gender === "M" ? "Male" : patient.gender === "F" ? "Female" : "Other",
          age: age || "N/A",
          birthdate: patient.birthdate ? moment(patient.birthdate).format("DD MMM YYYY") : "N/A",
        },
        visits: visitVitals,
        generatedAt: moment().format("DD MMM YYYY, hh:mm A"),
      };
    } catch (error) {
      logStream("error", error.message);
      throw error;
    }
  };

  return this;
})();
