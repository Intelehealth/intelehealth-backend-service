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
      console.log('✅ Using cached concept IDs');
      return conceptIdsCache;
    } else {
      console.log('⚠️  Cache exists but missing required concepts, fetching fresh...');
      conceptIdsCache = null; // Clear invalid cache
    }
  }
  
  console.log('🔍 Fetching concept IDs from database...');

  try {
    // Concept name mappings based on actual database values
    // Updated from concept_id.csv provided by user
    const conceptMappings = [
      { 
        searchTerms: [
          'SYSTOLIC BLOOD PRESSURE',  // concept_id: 5085
          'Systolic blood pressure',
          'SYSTOLIC BP',
          'SYSTOLIC'
        ], 
        key: 'SYSTOLIC_BP' 
      },
      { 
        searchTerms: [
          'DIASTOLIC BLOOD PRESSURE',  // concept_id: 5086
          'Diastolic blood pressure',
          'DIASTOLIC BP',
          'DIASTOLIC'
        ], 
        key: 'DIASTOLIC_BP' 
      },
      { 
        searchTerms: [
          'sugar random',  // concept_id: 165178 (preferred in frontend)
          'Sugar Random',
          'RANDOM BLOOD SUGAR',
          'BLOOD SUGAR',  // concept_id: 9 or 887 or 163355
          'Blood Sugar',
          'RBS',
          'RANDOM SUGAR'
        ], 
        key: 'BLOOD_SUGAR' 
      },
      { 
        searchTerms: [
          'HEMOGLOBIN',  // concept_id: 21
          'Hemoglobin',
          'HB',
          'HGB'
        ], 
        key: 'HEMOGLOBIN' 
      },
      { 
        searchTerms: [
          'Weight (kg)',  // concept_id: 5089
          'WEIGHT (KG)',
          'WEIGHT',
          'Weight'
        ], 
        key: 'WEIGHT' 
      },
      { 
        searchTerms: [
          'HEIGHT',
          'Height',
          'Height (cm)',
          'HEIGHT (CM)',
          'Height in cm'
        ], 
        key: 'HEIGHT' 
      },
      { 
        searchTerms: [
          'BMI',
          'BODY MASS INDEX',
          'Body Mass Index',
          'Body Mass Index (BMI)'
        ], 
        key: 'BMI' 
      },
      { 
        searchTerms: [
          'TEMPERATURE',
          'TEMP',
          'Temperature',
          'TEMPERATURE (C)',
          'Temperature (C)',
          'Temperature in Celsius'
        ], 
        key: 'TEMPERATURE' 
      },
      { 
        searchTerms: [
          'PULSE',  // concept_id: 5087
          'Pulse',
          'HEART RATE',
          'Heart Rate',
          'PULSE RATE',
          'Pulse Rate'
        ], 
        key: 'PULSE' 
      }
    ];

    const conceptIds = {};

    // Fetch concept IDs for each mapping
    for (const mapping of conceptMappings) {
      let found = false;
      
      // Try each search term until we find a match
      console.log(`\n🔍 Searching for: ${mapping.key}`);
      for (const searchTerm of mapping.searchTerms) {
        try {
          // Use case-insensitive exact match first (most reliable)
          let result = await sequelize.query(
            `SELECT DISTINCT cn.concept_id, cn.name, cn.locale_preferred, cn.concept_name_type
             FROM concept_name cn
             INNER JOIN concept c ON c.concept_id = cn.concept_id
             WHERE UPPER(cn.name) = UPPER(:searchTerm)
               AND cn.voided = 0
               AND c.retired = 0
             ORDER BY 
               CASE WHEN cn.locale_preferred = 1 THEN 1 ELSE 2 END,
               CASE WHEN cn.concept_name_type = 'FULLY_SPECIFIED' THEN 1 ELSE 2 END,
               cn.date_created DESC
             LIMIT 1`,
            {
              replacements: { searchTerm: searchTerm.trim() },
              type: QueryTypes.SELECT,
            }
          );

          // If no exact match, try LIKE search (partial match)
          if (!result || result.length === 0) {
            result = await sequelize.query(
              `SELECT DISTINCT cn.concept_id, cn.name, cn.locale_preferred, cn.concept_name_type
               FROM concept_name cn
               INNER JOIN concept c ON c.concept_id = cn.concept_id
               WHERE UPPER(cn.name) LIKE UPPER(:searchTerm)
                 AND cn.voided = 0
                 AND c.retired = 0
               ORDER BY 
                 CASE WHEN cn.locale_preferred = 1 THEN 1 ELSE 2 END,
                 CASE WHEN cn.concept_name_type = 'FULLY_SPECIFIED' THEN 1 ELSE 2 END,
                 cn.date_created DESC
               LIMIT 1`,
              {
                replacements: { searchTerm: `%${searchTerm.trim()}%` },
                type: QueryTypes.SELECT,
              }
            );
          }

          if (result && result.length > 0) {
            conceptIds[mapping.key] = result[0].concept_id;
            console.log(`   ✅ Found: "${result[0].name}" → concept_id: ${result[0].concept_id}`);
            found = true;
            break; // Found a match, move to next mapping
          } else {
            console.log(`   ❌ No match for: "${searchTerm}"`);
          }
        } catch (termError) {
          // Continue to next search term if this one fails
          console.error(`   ⚠️  Error searching for "${searchTerm}": ${termError.message}`);
          logStream("warning", `Error searching for term "${searchTerm}": ${termError.message}`);
        }
      }

      if (!found) {
        logStream("warning", `Concept ID not found for: ${mapping.key} (searched: ${mapping.searchTerms.join(', ')})`);
        console.error(`❌ Concept ID not found for: ${mapping.key}`);
        console.error(`   Searched terms: ${mapping.searchTerms.join(', ')}`);
      } else {
        console.log(`✅ Found concept ID for ${mapping.key}: ${conceptIds[mapping.key]}`);
        logStream("info", `Found concept ID for ${mapping.key}: ${conceptIds[mapping.key]}`);
      }
    }

    // Also set RBS alias if BLOOD_SUGAR was found
    if (conceptIds.BLOOD_SUGAR) {
      conceptIds.RBS = conceptIds.BLOOD_SUGAR;
    }

    // Fallback: If required concepts are missing, use known concept IDs from CSV
    // This ensures the service works even if search fails
    // IMPORTANT: Do this BEFORE logging and caching
    const knownConceptIds = {
      SYSTOLIC_BP: 5085,
      DIASTOLIC_BP: 5086,
      BLOOD_SUGAR: 165178, // sugar random
      RBS: 165178,
      HEMOGLOBIN: 21,
      WEIGHT: 5089,
      PULSE: 5087
    };
    
    const requiredKeys = ['SYSTOLIC_BP', 'DIASTOLIC_BP', 'HEMOGLOBIN', 'BLOOD_SUGAR'];
    const missingRequired = requiredKeys.filter(key => !conceptIds[key]);
    
    if (missingRequired.length > 0) {
      console.log(`\n Using fallback concept IDs for missing concepts: ${missingRequired.join(', ')}`);
      missingRequired.forEach(key => {
        if (knownConceptIds[key]) {
          conceptIds[key] = knownConceptIds[key];
          console.log(`   ✓ Using fallback: ${key} = ${knownConceptIds[key]}`);
        }
      });
      
      // Also set RBS if BLOOD_SUGAR was set
      if (conceptIds.BLOOD_SUGAR && knownConceptIds.RBS) {
        conceptIds.RBS = conceptIds.BLOOD_SUGAR;
      }
    }

    // Log summary
    const foundCount = Object.keys(conceptIds).length;
    const requiredCount = conceptMappings.length;
    console.log(`\n Concept ID Summary: Found ${foundCount}/${requiredCount} required concepts`);
    
    if (foundCount < requiredCount) {
      const missing = conceptMappings
        .filter(m => !conceptIds[m.key])
        .map(m => ({ key: m.key, searchTerms: m.searchTerms }));
      
      if (missing.length > 0) {
        console.error(`\n Missing concepts (${missing.length}):`);
        missing.forEach(m => {
          console.error(`   - ${m.key}`);
          console.error(`     Searched: ${m.searchTerms.slice(0, 3).join(', ')}${m.searchTerms.length > 3 ? '...' : ''}`);
        });
      }
    } else {
      console.log(`✅ All required concepts found successfully!`);
    }

    // Cache the results (only if we have all required concepts after fallback)
    const hasAllRequired = requiredKeys.every(key => conceptIds[key]);
    if (hasAllRequired) {
      conceptIdsCache = conceptIds;
      logStream("debug", "Concept IDs fetched from database", JSON.stringify(conceptIds));
    } else {
      console.error(`\n Not caching incomplete concept IDs. Please check database connection and concept names.`);
    }
    
    return conceptIds;
  } catch (error) {
    logStream("error", `Error fetching concept IDs: ${error.message}`);
    console.error(`\n💡 To verify concept names in your database, run this SQL query:`);
    console.error(`   SELECT concept_id, name, locale_preferred, concept_name_type`);
    console.error(`   FROM concept_name`);
    console.error(`   WHERE voided = 0`);
    console.error(`   AND (name LIKE '%BLOOD%' OR name LIKE '%PRESSURE%' OR name LIKE '%SUGAR%'`);
    console.error(`   OR name LIKE '%HEMOGLOBIN%' OR name LIKE '%WEIGHT%' OR name LIKE '%PULSE%')`);
    console.error(`   ORDER BY name;`);
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
console.log("Fetching NCD Report Data for patient:", patientUuid);

      // Fetch concept IDs from database
      const CONCEPT_IDS = await getConceptIds();
      
      // Check if we have at least the minimum required concepts
      const requiredConcepts = ['SYSTOLIC_BP', 'DIASTOLIC_BP', 'HEMOGLOBIN', 'BLOOD_SUGAR'];
      const missingRequired = requiredConcepts.filter(key => !CONCEPT_IDS[key]);
      
      if (missingRequired.length > 0) {
        const errorMsg = `Unable to fetch required concept IDs from database. Missing: ${missingRequired.join(', ')}. Please verify concept names in OpenMRS. Check console logs for SQL query.`;
        logStream("error", errorMsg);
        throw new Error(errorMsg);
      }
      
      if (!CONCEPT_IDS || Object.keys(CONCEPT_IDS).length === 0) {
        logStream("error", "No concept IDs found in database");
        throw new Error("Unable to fetch concept IDs from database. Please verify concept names in OpenMRS. Check console logs for SQL query.");
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

      console.log(` Checking for NCD visit attribute type 'isNcdSevikaVisit'...`);
      if (!ncdVisitAttributeType) {
        console.log(`    NCD visit attribute type 'isNcdSevikaVisit' not found, falling back to encounter type filter`);
        logStream("warning", "NCD visit attribute type 'isNcdSevikaVisit' not found, falling back to encounter type filter");
      } else {
        console.log(`  Found attribute type ID: ${ncdVisitAttributeType.visit_attribute_type_id}`);
      }

      // Get last 7 NCD visits for the patient
      // If multiple visits exist on the same date, they are ordered by time (most recent first)
      let visits;
      
      if (ncdVisitAttributeType) {
        // Use visit_attribute to filter NCD visits
        console.log(`\n🔍 Searching for visits with isNcdSevikaVisit attribute...`);
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

        console.log(`   Found ${ncdVisitIds.length} visits with isNcdSevikaVisit attribute`);
        const ncdVisitIdList = ncdVisitIds.map(v => v.visit_id);

        if (ncdVisitIdList.length === 0) {
          console.log(`   ⚠️  No visits found with isNcdSevikaVisit attribute for patient ${personId}`);
          visits = [];
        } else {
          console.log(`   ✓ Filtering ${ncdVisitIdList.length} NCD visits for patient ${personId}`);
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
            logging: (sql) => {
              console.log("=== NCD VISITS QUERY (by visit_attribute) ===");
              console.log(sql);
              console.log("=== END QUERY ===");
            },
          });
        }
      } else {
        // Fallback to encounter type filter if visit_attribute not found
        console.log(`\n🔍 Using fallback: Searching for visits with encounter_type = 6 (Vitals) for patient ${personId}...`);
        
        // First, let's check if patient has any visits at all
        const allVisitsCount = await visit.count({
          where: {
            patient_id: personId,
            voided: 0,
          }
        });
        console.log(`   Total visits for patient: ${allVisitsCount}`);
        
        // Check visits with encounter_type 6
        const vitalsVisitsCount = await visit.count({
          where: {
            patient_id: personId,
            voided: 0,
          },
          include: [
            {
              model: encounter,
              as: "encounters",
              where: {
                voided: 0,
                encounter_type: 6,
              },
              required: true,
            },
          ],
        });
        console.log(`   Visits with encounter_type 6 (Vitals): ${vitalsVisitsCount}`);
        
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
          logging: (sql) => {
            console.log("=== NCD VISITS QUERY (by encounter_type) ===");
            console.log(sql);
            console.log("=== END QUERY ===");
          },
        });
        
        console.log(`   ✓ Found ${visits.length} visits with encounter_type 6 and vitals observations`);
      }
      
      console.log(`\n📊 Final result: ${visits.length} NCD visits found for patient ${personId}`);
      
      // If no visits found with either method, try a more flexible approach:
      // Find any visits that have the required vitals observations, regardless of attribute or encounter type
      if (visits.length === 0) {
        console.log(`\n⚠️  No visits found with standard filters. Trying flexible approach: any visit with vitals observations...`);
        
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
          logging: (sql) => {
            console.log("=== NCD VISITS QUERY (flexible - any visit with vitals) ===");
            console.log(sql);
          },
        });
        
        console.log(`   ✓ Found ${visits.length} visits with vitals observations (flexible query)`);
      }

      // Process visits to extract vitals
      // Visits are already ordered by date_started DESC (includes time component)
      // So if multiple visits exist on the same date, they are ordered by time (most recent first)
      // If multiple readings exist for the same vital within a visit, pick the latest one (by obs_datetime)
      console.log(`\n📅 Processing ${visits.length} visits (ordered by date_started DESC - includes time):`);
      visits.forEach((v, idx) => {
        const visitJson = v.toJSON();
        console.log(`   ${idx + 1}. Visit ${visitJson.uuid.substring(0, 8)}... - Date: ${moment(visitJson.date_started).format("YYYY-MM-DD HH:mm:ss")}`);
      });
      
      const visitVitals = visits.map((v) => {
        const visitJson = v.toJSON();
        const vitals = {
          visitUuid: visitJson.uuid,
          visitDate: moment(visitJson.date_started).format("DD MMM, YY"),
          visitDateTime: moment(visitJson.date_started).format("DD MMM, YY HH:mm"), // Include time for reference
          systolicBP: null,
          diastolicBP: null,
          bloodPressure: null, // Combined BP display
          bloodSugar: null,
          hemoglobin: null,
          weight: null,
          bmi: null,
          temperature: null,
          pulse: null,
        };

        // Group observations by concept_id and get the latest one
        const obsMap = {};
        visitJson.encounters?.forEach((encounter) => {
          encounter.obs?.forEach((observation) => {
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
          if (conceptId === CONCEPT_IDS.SYSTOLIC_BP) {
            vitals.systolicBP = observation.value_numeric;
          } else if (conceptId === CONCEPT_IDS.DIASTOLIC_BP) {
            vitals.diastolicBP = observation.value_numeric;
          } else if (conceptId === CONCEPT_IDS.BLOOD_SUGAR || conceptId === CONCEPT_IDS.RBS) {
            vitals.bloodSugar = observation.value_numeric;
          } else if (conceptId === CONCEPT_IDS.HEMOGLOBIN) {
            vitals.hemoglobin = observation.value_numeric;
          } else if (conceptId === CONCEPT_IDS.WEIGHT) {
            vitals.weight = observation.value_numeric;
          } else if (conceptId === CONCEPT_IDS.BMI) {
            vitals.bmi = observation.value_numeric;
          } else if (conceptId === CONCEPT_IDS.TEMPERATURE) {
            vitals.temperature = observation.value_numeric;
          } else if (conceptId === CONCEPT_IDS.PULSE) {
            vitals.pulse = observation.value_numeric;
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

        // Log HB and RBS values for verification
        if (vitals.hgb !== 'N/A' || vitals.rbs !== 'N/A') {
          console.log(`   ✓ Visit ${visitJson.uuid.substring(0, 8)}... - HB: ${vitals.hgb}, RBS: ${vitals.rbs}`);
        }

        // Color coding flags removed - no longer needed

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
