const moment = require("moment");
const { QueryTypes } = require("sequelize");
const {
  visit,
  encounter,
  patient_identifier,
  person_name,
  encounter_type,
  person,
  obs,
  visit_attribute,
  visit_attribute_type,
  concept_name,
  sequelize,
  Sequelize,
} = require("../openmrs_models");
const { links } = require("../models");
const { generateHash } = require("../handlers/helper");
const { logStream } = require("../logger/index");
const Op = Sequelize.Op;

// Cache for concept IDs to avoid repeated database queries
let conceptIdsCache = null;

// Function to clear cache (useful for debugging)
function clearConceptIdsCache() {
  conceptIdsCache = null;
}

/**
 * Fetch concept IDs from concept_name table by concept names
 * Uses concept_name table to dynamically fetch concept IDs instead of hardcoding
 * @returns {Promise<Object>} Object with concept IDs mapped by name
 */
async function getConceptIds() {
  // Return cached values if available (but only if it has required keys)
  if (conceptIdsCache !== null && typeof conceptIdsCache === 'object') {
    const requiredKeys = ['SYSTOLIC_BP', 'DIASTOLIC_BP', 'HEMOGLOBIN', 'BLOOD_SUGAR'];
    const hasRequired = requiredKeys.every(key => conceptIdsCache[key]);
    if (hasRequired && Object.keys(conceptIdsCache).length > 0) {
      return conceptIdsCache;
    } else {
      conceptIdsCache = null; // Clear invalid cache
    }
  }

  try {
    // Define concept UUIDs (from frontend visit-summary component)
    // These are the exact UUIDs used by the Intelehealth frontend
    // UUID format in OpenMRS: concept.uuid column
    // Only fetch concept IDs for NCD vitals: BP, HB, RBS
    const conceptUuidMappings = [
      { uuid: '5085AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', key: 'SYSTOLIC_BP' },
      { uuid: '5086AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', key: 'DIASTOLIC_BP' },
      { uuid: '95cf1d31-21dc-4fae-96fd-d1dd9455914f', key: 'BLOOD_SUGAR' },  // Sugar Random (RBS)
      { uuid: '33b241d6-3e9d-443e-9572-f38ecb1e752a', key: 'HEMOGLOBIN' }    // Haemoglobin (HB)
    ];

    const conceptIds = {};

    // Fetch concept IDs by UUID (most reliable method - no ambiguity)
    for (const mapping of conceptUuidMappings) {
      try {
        const result = await sequelize.query(
          `SELECT concept_id, uuid
           FROM concept
           WHERE uuid = :uuid
             AND retired = 0
           LIMIT 1`,
          {
            replacements: { uuid: mapping.uuid },
            type: QueryTypes.SELECT,
          }
        );

        if (result && result.length > 0) {
          conceptIds[mapping.key] = result[0].concept_id;
        } else {
          logStream("warning", `Concept not found for ${mapping.key} with UUID ${mapping.uuid}`);
        }
      } catch (err) {
        logStream("error", `Error fetching concept ${mapping.key}: ${err.message}`);
      }
    }

    // Also set RBS alias if BLOOD_SUGAR was found
    if (conceptIds.BLOOD_SUGAR) {
      conceptIds.RBS = conceptIds.BLOOD_SUGAR;
    }

    // Fallback: If required concepts are missing, try known concept IDs
    // This ensures the service works even if UUID lookup fails
    // Only NCD vitals: BP, HB, RBS
    const knownConceptIds = {
      SYSTOLIC_BP: 5085,
      DIASTOLIC_BP: 5086,
      BLOOD_SUGAR: 165178, // Sugar Random (from UUID: 95cf1d31-21dc-4fae-96fd-d1dd9455914f)
      RBS: 165178,
      HEMOGLOBIN: 165175  // Haemoglobin (from UUID: 33b241d6-3e9d-443e-9572-f38ecb1e752a)
    };

    const requiredKeys = ['SYSTOLIC_BP', 'DIASTOLIC_BP', 'HEMOGLOBIN', 'BLOOD_SUGAR'];
    
    // Use fallback concept IDs for any missing required concepts
    requiredKeys.forEach(key => {
      if (!conceptIds[key] && knownConceptIds[key]) {
        conceptIds[key] = knownConceptIds[key];
      }
    });

    // Also set RBS if BLOOD_SUGAR was set
    if (conceptIds.BLOOD_SUGAR) {
      conceptIds.RBS = conceptIds.BLOOD_SUGAR;
    }


    // Cache the results (only if we have all required concepts after fallback)
    const hasAllRequired = requiredKeys.every(key => conceptIds[key]);
    if (hasAllRequired) {
      conceptIdsCache = conceptIds;
      logStream("debug", "Concept IDs fetched from database", JSON.stringify(conceptIds));
    }
    
    return conceptIds;
  } catch (error) {
    logStream("error", `Error fetching concept IDs: ${error.message}`);
    // Return empty object if fetch fails
    return {};
  }
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

      // Fetch concept IDs from database (only BP, HB, RBS)
      const CONCEPT_IDS = await getConceptIds();
      
      // Check if we have all required concepts: BP (systolic/diastolic), HB, RBS
      const requiredConcepts = ['SYSTOLIC_BP', 'DIASTOLIC_BP', 'HEMOGLOBIN', 'BLOOD_SUGAR'];
      const hasAllRequired = requiredConcepts.every(key => CONCEPT_IDS[key]);
      
      if (!hasAllRequired || !CONCEPT_IDS || Object.keys(CONCEPT_IDS).length === 0) {
        logStream("error", "Unable to fetch required concept IDs from database");
        throw new Error("Unable to fetch required concept IDs from database. Please verify concept names in OpenMRS.");
      }


      // Get patient person_id from UUID
      const personIdResult = await sequelize.query(
        `SELECT person_id FROM person WHERE uuid = :patientUuid AND voided = 0 LIMIT 1`,
        {
          replacements: { patientUuid },
          type: QueryTypes.SELECT,
        }
      );

      if (!personIdResult || personIdResult.length === 0) {
        throw new Error("Patient not found");
      }

      const personId = personIdResult[0].person_id;

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

      // Find NCD visit attribute type
      const ncdVisitAttributeType = await visit_attribute_type.findOne({
        where: {
          name: 'isNcdSevikaVisit'
        }
      });

      if (!ncdVisitAttributeType) {
        logStream("warning", "NCD visit attribute type 'isNcdSevikaVisit' not found, falling back to encounter type filter");
      }

      // Get last 7 NCD visits for the patient
      // If multiple visits exist on the same date, they are ordered by time (most recent first)
      let visits;
      
      if (ncdVisitAttributeType) {
        // Use visit_attribute to filter NCD visits
        const ncdVisitIds = await visit_attribute.findAll({
          where: {
            attribute_type_id: ncdVisitAttributeType.visit_attribute_type_id,
            voided: 0,
            [Op.or]: [
              { value_reference: 'true' },
              { value_reference: { [Op.like]: '%true%' } }
            ]
          },
          attributes: ['visit_id'],
          raw: true
        });

        const ncdVisitIdList = ncdVisitIds.map(v => v.visit_id);

        if (ncdVisitIdList.length === 0) {
          visits = [];
        } else {
          visits = await visit.findAll({
            where: {
              patient_id: personId,
              visit_id: { [Op.in]: ncdVisitIdList },
              voided: 0,
            },
            attributes: ["visit_id", "uuid", "date_started", "date_stopped"],
            include: [
              {
                model: encounter,
                as: "encounters",
                attributes: ["encounter_id", "encounter_datetime", "encounter_type"],
                where: {
                  voided: 0,
                },
                required: false,
                include: [
                  {
                    model: obs,
                    as: "obs",
                    attributes: [
                      "obs_id",
                      "concept_id",
                      "value_numeric",
                      "value_text",
                      "obs_datetime",
                    ],
                    where: {
                      voided: 0,
                      concept_id: {
                        [Op.in]: Object.values(CONCEPT_IDS),
                      },
                    },
                    required: false,
                  },
                ],
              },
            ],
            order: [["date_started", "DESC"]],
            limit: 7,
          });
        }
      } else {
        // Fallback to encounter type filter if visit_attribute not found
        visits = await visit.findAll({
          where: {
            patient_id: personId,
            voided: 0,
          },
          attributes: ["visit_id", "uuid", "date_started", "date_stopped"],
          include: [
            {
              model: encounter,
              as: "encounters",
              attributes: ["encounter_id", "encounter_datetime", "encounter_type"],
              where: {
                voided: 0,
                // Filter for Vitals encounter type (typically type 6)
                encounter_type: 6,
              },
              required: true,
              include: [
                {
                  model: obs,
                  as: "obs",
                  attributes: [
                    "obs_id",
                    "concept_id",
                    "value_numeric",
                    "value_text",
                    "obs_datetime",
                  ],
                  where: {
                    voided: 0,
                    concept_id: {
                      [Op.in]: Object.values(CONCEPT_IDS),
                    },
                  },
                  required: false,
                },
              ],
            },
          ],
          order: [["date_started", "DESC"]],
          limit: 7,
        });
      }
      
      // If no visits found with either method, try a more flexible approach:
      // Find any visits that have the required vitals observations, regardless of attribute or encounter type
      if (visits.length === 0) {
        visits = await visit.findAll({
          where: {
            patient_id: personId,
            voided: 0,
          },
          attributes: ["visit_id", "uuid", "date_started", "date_stopped"],
          include: [
            {
              model: encounter,
              as: "encounters",
              attributes: ["encounter_id", "encounter_datetime", "encounter_type"],
              where: {
                voided: 0,
              },
              required: false,
              include: [
                {
                  model: obs,
                  as: "obs",
                  attributes: [
                    "obs_id",
                    "concept_id",
                    "value_numeric",
                    "value_text",
                    "obs_datetime",
                  ],
                  where: {
                    voided: 0,
                    concept_id: {
                      [Op.in]: Object.values(CONCEPT_IDS),
                    },
                  },
                  required: true, // Only include visits that have at least one vital observation
                },
              ],
            },
          ],
          order: [["date_started", "DESC"]],
          limit: 7,
        });
      }

      // If we still have fewer than 7 visits, try to get more by removing the required constraint on observations
      if (visits.length < 7) {
        const allVisits = await visit.findAll({
          where: {
            patient_id: personId,
            voided: 0,
          },
          attributes: ["visit_id", "uuid", "date_started", "date_stopped"],
          include: [
            {
              model: encounter,
              as: "encounters",
              attributes: ["encounter_id", "encounter_datetime", "encounter_type"],
              where: {
                voided: 0,
              },
              required: false, // Don't require encounters
              include: [
                {
                  model: obs,
                  as: "obs",
                  attributes: [
                    "obs_id",
                    "concept_id",
                    "value_numeric",
                    "value_text",
                    "obs_datetime",
                  ],
                  where: {
                    voided: 0,
                    concept_id: {
                      [Op.in]: Object.values(CONCEPT_IDS),
                    },
                  },
                  required: false, // Don't require observations
                },
              ],
            },
          ],
          order: [["date_started", "DESC"]],
          limit: 7,
        });
        
        // Filter to only include visits that have at least one vital observation
        const visitsWithVitals = allVisits.filter(v => {
          const visitJson = v.toJSON();
          return visitJson.encounters?.some(enc => 
            enc.obs?.some(obs => Object.values(CONCEPT_IDS).includes(obs.concept_id))
          );
        });
        
        if (visitsWithVitals.length > visits.length) {
          visits = visitsWithVitals.slice(0, 7); // Limit to 7
        }
      }

      // Process visits to extract vitals
      // Visits are already ordered by date_started DESC (includes time component)
      // So if multiple visits exist on the same date, they are ordered by time (most recent first)
      // If multiple readings exist for the same vital within a visit, pick the latest one (by obs_datetime)
      
      const visitVitals = visits.map((v) => {
        const visitJson = v.toJSON();
        // Only NCD vitals: BP, HB, RBS
        const vitals = {
          visitUuid: visitJson.uuid,
          visitDate: moment(visitJson.date_started).format("DD MMM, YY"),
          visitDateTime: moment(visitJson.date_started).format("DD MMM, YY HH:mm"), // Include time for reference
          systolicBP: null,
          diastolicBP: null,
          bloodPressure: null, // Combined BP display
          bloodSugar: null,
          hemoglobin: null,
        };

        // Group observations by concept_id and get the latest one
        const obsMap = {};
        let allObservations = [];
        visitJson.encounters?.forEach((encounter) => {
          encounter.obs?.forEach((observation) => {
            allObservations.push(observation);
            const conceptId = observation.concept_id;
            // Keep only the latest observation for each concept
            if (
              !obsMap[conceptId] ||
              new Date(observation.obs_datetime) >
                new Date(obsMap[conceptId].obs_datetime)
            ) {
              obsMap[conceptId] = observation;
            }
          });
        });


        // Extract vitals from the latest observations using dynamically fetched concept IDs
        Object.values(obsMap).forEach((observation) => {
          const conceptId = observation.concept_id;
          // Use value_numeric if available, otherwise fallback to value_text (parsed as number if possible)
          const numericValue = observation.value_numeric !== null && observation.value_numeric !== undefined 
            ? observation.value_numeric 
            : (observation.value_text ? parseFloat(observation.value_text) : null);
          if (conceptId === CONCEPT_IDS.SYSTOLIC_BP) {
            vitals.systolicBP = numericValue;
          } else if (conceptId === CONCEPT_IDS.DIASTOLIC_BP) {
            vitals.diastolicBP = numericValue;
          } else if (conceptId === CONCEPT_IDS.BLOOD_SUGAR || conceptId === CONCEPT_IDS.RBS) {
            vitals.bloodSugar = numericValue;
          } else if (conceptId === CONCEPT_IDS.HEMOGLOBIN) {
            vitals.hemoglobin = numericValue;
          }
        });

        // Combine BP for display
        if (vitals.systolicBP && vitals.diastolicBP) {
          vitals.bloodPressure = `${vitals.systolicBP}/${vitals.diastolicBP}`;
          vitals.bp = `${vitals.systolicBP}/${vitals.diastolicBP}`;
        } else if (vitals.systolicBP) {
          vitals.bloodPressure = `${vitals.systolicBP}/-`;
          vitals.bp = `${vitals.systolicBP}/-`;
        } else if (vitals.diastolicBP) {
          vitals.bloodPressure = `-/${vitals.diastolicBP}`;
          vitals.bp = `-/${vitals.diastolicBP}`;
        } else {
          vitals.bloodPressure = 'N/A';
          vitals.bp = 'N/A';
        }

        // Add aliases for HTML compatibility
        vitals.hgb = vitals.hemoglobin !== null && vitals.hemoglobin !== undefined ? vitals.hemoglobin : 'N/A';
        vitals.rbs = vitals.bloodSugar !== null && vitals.bloodSugar !== undefined ? vitals.bloodSugar : 'N/A';
        vitals.date = vitals.visitDate;

        return vitals;
      });

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
