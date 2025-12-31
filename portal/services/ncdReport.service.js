const moment = require("moment");
const { QueryTypes } = require("sequelize");
const {
  visit,
  patient_identifier,
  person_name,
  person,
  sequelize,
} = require("../openmrs_models");

const { logStream } = require("../logger/index");

/**
 * Parse NCD screening data from CURRENT COMPLAINT observation text
 * The frontend stores NCD data as formatted HTML text in the CURRENT_COMPLAINT observation
 * Example format: "►NCD - Diabetes Screening::● Random Blood Sugar(mg/dL)*<br/>• 300<br/>● Haemoglobin(gm/dL)*<br/>• 12<br/>..."
 * @param {string} complaintText - The HTML formatted text from CURRENT_COMPLAINT observation
 * @returns {Object} - Parsed NCD values {rbs: number|null, hemoglobin: number|null}
 */
function parseNCDScreeningFromComplaint(complaintText) {
  if (!complaintText || typeof complaintText !== 'string') {
    return { rbs: null, hemoglobin: null, systolicBP: null, diastolicBP: null };
  }

  const result = { rbs: null, hemoglobin: null, systolicBP: null, diastolicBP: null };

  try {
    // Parse Random Blood Sugar (RBS)
    // Format: "• Random Blood Sugar(mg/dL) - 300<br/>"
    const rbsPatterns = [
      /Random Blood Sugar\(mg\/dL\)\s*-\s*(\d+(?:\.\d+)?)/i,
      /Random Blood Sugar\(mg\/dL\)[^<]*?(\d+(?:\.\d+)?)\s*<br/i,
      /Random Blood Sugar\s*-\s*(\d+(?:\.\d+)?)/i,
      /RBS\s*-\s*(\d+(?:\.\d+)?)/i
    ];

    for (const pattern of rbsPatterns) {
      const rbsMatch = complaintText.match(pattern);
      if (rbsMatch && rbsMatch[1]) {
        result.rbs = parseFloat(rbsMatch[1]);
        console.log(`[NCD Parser] ✅ Found RBS: ${result.rbs}`);
        break;
      }
    }

    // Parse Haemoglobin (HB)
    // Format: "• Hemoglobin(Hb) Measurement - 12.0<br/>"
    const hbPatterns = [
      /H[ae]moglobin\(Hb\)\s*Measurement\s*-\s*(\d+(?:\.\d+)?)/i,
      /H[ae]moglobin\(gm\/dL\)\s*-\s*(\d+(?:\.\d+)?)/i,
      /H[ae]moglobin\(gm\/dL\)[^<]*?(\d+(?:\.\d+)?)\s*<br/i,
      /H[ae]moglobin\s*-\s*(\d+(?:\.\d+)?)/i,
      /HB\s*-\s*(\d+(?:\.\d+)?)/i
    ];

    for (const pattern of hbPatterns) {
      const hbMatch = complaintText.match(pattern);
      if (hbMatch && hbMatch[1]) {
        result.hemoglobin = parseFloat(hbMatch[1]);
        console.log(`[NCD Parser] ✅ Found Hemoglobin: ${result.hemoglobin}`);
        break;
      }
    }

    // Parse Blood Pressure (BP)
    // Format: "• BP Measurement - 220/100<br/>"
    // Extract the LAST BP value if multiple readings exist (per requirement)
    const bpPattern = /BP\s*Measurement\s*-\s*(\d+)\/(\d+)/gi;
    let bpMatch;
    let lastSystolic = null;
    let lastDiastolic = null;

    // Find all BP matches and keep the last one (latest/final reading)
    while ((bpMatch = bpPattern.exec(complaintText)) !== null) {
      lastSystolic = parseInt(bpMatch[1]);
      lastDiastolic = parseInt(bpMatch[2]);
    }

    if (lastSystolic !== null && lastDiastolic !== null) {
      result.systolicBP = lastSystolic;
      result.diastolicBP = lastDiastolic;
      console.log(`[NCD Parser] ✅ Found BP: ${lastSystolic}/${lastDiastolic}`);
    }

    if (result.rbs || result.hemoglobin || result.systolicBP || result.diastolicBP) {
      console.log(`[NCD Parser] Successfully parsed NCD data from CURRENT_COMPLAINT:`, result);
    }
  } catch (error) {
    console.error(`[NCD Parser] Error parsing NCD data:`, error.message);
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
      console.log(`[NCD Report] Fetching NCD report for patient: ${patientUuid}`);


      // Get patient person_id from UUID
      console.log(`[NCD Report] Searching for patient with UUID: ${patientUuid}`);
      const personIdResult = await sequelize.query(
        `SELECT person_id FROM person WHERE uuid = :patientUuid AND voided = 0 LIMIT 1`,
        {
          replacements: { patientUuid },
          type: QueryTypes.SELECT,
        }
      );

      if (!personIdResult || personIdResult.length === 0) {
        console.error(`[NCD Report] ❌ Patient not found with UUID: ${patientUuid}`);
        throw new Error("Patient not found");
      }

      const personId = personIdResult[0].person_id;
      console.log(`[NCD Report] ✅ Found patient with person_id: ${personId}`);

      // Get patient demographics
      const patientData = await person.findOne({
        where: { person_id: personId, voided: 0 },
        attributes: ["uuid", "gender", "birthdate"],
        include: [
          {
            model: person_name,
            as: "person_name",
            attributes: ["given_name", "family_name", "middle_name"],
            where: { voided: 0 },
            required: false,
          },
        ],
      });

      if (!patientData) {
        throw new Error("Patient data not found");
      }

      // Fetch preferred patient identifier using raw query
      // patient_identifier is not associated with person, so we query it separately
      const identifierResult = await sequelize.query(
        `SELECT identifier FROM patient_identifier 
         WHERE patient_id = :personId AND voided = 0 AND preferred = 1 
         ORDER BY date_created DESC LIMIT 1`,
        {
          replacements: { personId },
          type: QueryTypes.SELECT,
        }
      );

      const openMrsId = identifierResult && identifierResult.length > 0 
        ? identifierResult[0].identifier 
        : "N/A";

      // Fetch preferred person name using raw query (if not available from include)
      let patientName = null;
      if (patientData.person_name && patientData.person_name.length > 0) {
        patientName = patientData.person_name[0];
      } else {
        const nameResult = await sequelize.query(
          `SELECT given_name, family_name, middle_name FROM person_name 
           WHERE person_id = :personId AND voided = 0 AND preferred = 1 
           ORDER BY date_created DESC LIMIT 1`,
          {
            replacements: { personId },
            type: QueryTypes.SELECT,
          }
        );
        if (nameResult && nameResult.length > 0) {
          patientName = nameResult[0];
        }
      }

      // Calculate age from birthdate
      const age = patientData.birthdate
        ? moment().diff(moment(patientData.birthdate), "years")
        : null;

      // Get last 7 visits for the patient (simple query - no filtering by concept_id or attributes)
      console.log(`[NCD Report] Fetching last 7 visits for patient ${patientUuid}`);

      const visits = await visit.findAll({
        where: {
          patient_id: personId,
          voided: 0,
        },
        attributes: ["visit_id", "uuid", "date_started", "date_stopped"],
        order: [["date_started", "DESC"]],
        limit: 7,
      });

      console.log(`[NCD Report] Found ${visits.length} visits for patient ${patientUuid}`);

      // Process visits to extract NCD vitals from CURRENT_COMPLAINT
      const visitVitals = await Promise.all(visits.map(async (v) => {
        const visitJson = v.toJSON();

        // Only NCD vitals: BP, HB, RBS
        const vitals = {
          visitUuid: visitJson.uuid,
          visitDate: moment(visitJson.date_started).format("DD MMM, YY"),
          visitDateTime: moment(visitJson.date_started).format("DD MMM, YY HH:mm"),
          systolicBP: null,
          diastolicBP: null,
          bloodPressure: null, // Combined BP display
          bloodSugar: null,
          hemoglobin: null,
        };

        console.log(`[NCD Report] Processing visit ${visitJson.uuid}`);

        // Parse NCD screening data from CURRENT_COMPLAINT (concept_id 163212)
        console.log(`[NCD Report] 🔍 Searching for CURRENT_COMPLAINT to parse NCD data for visit ${visitJson.uuid}`);

        try {
          const currentComplaintObs = await sequelize.query(
            `SELECT o.obs_id, o.concept_id, o.value_text, o.obs_datetime
             FROM obs o
             INNER JOIN encounter e ON o.encounter_id = e.encounter_id
             INNER JOIN visit v ON e.visit_id = v.visit_id
             WHERE v.uuid = :visitUuid
               AND o.concept_id = 163212
               AND o.voided = 0
               AND e.voided = 0
               AND v.voided = 0
             ORDER BY o.obs_datetime DESC
             LIMIT 1`,
            {
              replacements: { visitUuid: visitJson.uuid },
              type: QueryTypes.SELECT,
            }
          );

          if (currentComplaintObs && currentComplaintObs.length > 0 && currentComplaintObs[0].value_text) {
            console.log(`[NCD Report] ✅ Found CURRENT_COMPLAINT, parsing NCD data...`);
            const ncdData = parseNCDScreeningFromComplaint(currentComplaintObs[0].value_text);

            if (ncdData.rbs !== null) {
              vitals.bloodSugar = ncdData.rbs;
              console.log(`[NCD Report] ✅ Extracted RBS: ${ncdData.rbs}`);
            }

            if (ncdData.hemoglobin !== null) {
              vitals.hemoglobin = ncdData.hemoglobin;
              console.log(`[NCD Report] ✅ Extracted HB: ${ncdData.hemoglobin}`);
            }

            if (ncdData.systolicBP !== null) {
              vitals.systolicBP = ncdData.systolicBP;
              vitals.diastolicBP = ncdData.diastolicBP;
              vitals.bloodPressure = `${ncdData.systolicBP}/${ncdData.diastolicBP}`;
              console.log(`[NCD Report] ✅ Extracted BP: ${ncdData.systolicBP}/${ncdData.diastolicBP}`);
            }
          } else {
            console.log(`[NCD Report] ⚠️ No CURRENT_COMPLAINT found for visit ${visitJson.uuid}`);
          }
        } catch (err) {
          console.error(`[NCD Report] ❌ Error parsing CURRENT_COMPLAINT for visit ${visitJson.uuid}:`, err.message);
        }

        // Add display aliases for frontend compatibility
        vitals.hgb = vitals.hemoglobin !== null ? vitals.hemoglobin : 'N/A';
        vitals.rbs = vitals.bloodSugar !== null ? vitals.bloodSugar : 'N/A';
        vitals.bp = vitals.bloodPressure || 'N/A';
        vitals.date = vitals.visitDate;

        console.log(`[NCD Report] 📊 Final vitals for visit ${visitJson.uuid} - BP=${vitals.bp}, HB=${vitals.hgb}, RBS=${vitals.rbs}`);

        return vitals;
      }));

      // Prepare patient information for the report
      const patientJson = patientData.toJSON();

      // Format patient name
      const formattedName = patientName
        ? `${patientName.given_name || ""} ${
            patientName.middle_name ? patientName.middle_name + " " : ""
          }${patientName.family_name || ""}`.trim()
        : "N/A";

      const reportData = {
        patient: {
          uuid: patientJson.uuid,
          identifier: openMrsId,
          name: formattedName,
          gender: patientJson.gender === "M" ? "Male" : patientJson.gender === "F" ? "Female" : "Other",
          age: age || "N/A",
          birthdate: patientJson.birthdate
            ? moment(patientJson.birthdate).format("DD MMM YYYY")
            : "N/A",
        },
        visits: visitVitals,
        generatedAt: moment().format("DD MMM YYYY, hh:mm A"),
      };

      logStream("debug", "Success", "Get NCD Report Data");
      return reportData;
    } catch (error) {
      logStream("error", error.message);
      throw error;
    }
  };

  return this;
})();
