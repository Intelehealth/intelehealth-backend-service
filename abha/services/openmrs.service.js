const { uuid } = require('uuidv4');
const { openmrsAxiosInstance } = require('../handlers/axiosHelper');
const { convertDateToDDMMYYYY, convertToBase64 } = require('../handlers/utilityHelper');
const { logStream } = require('../logger');
const { patient_identifier, visit, Sequelize, encounter, person_name, person, person_attribute, visit_attribute, patient } = require('../openmrs_models');
const { VISIT_ATTRIBUTE_TYPES, IDENTIFIER_TYPES } = require('../constants/openmrs.constants');
const { Op } = Sequelize;

/**
 * Function to get the visits with formated response.
 * @param {Array} visits 
 * @returns visits with formated response
 */
function getFormatedResponse({ visits, patientInfo }) {
  if (!visits?.length) return null;
  const patient_identifier = patientInfo?.patient_identifier;
  const person = patientInfo?.person;
  const patient_name = patientInfo?.person?.person_name;
  const abhaAddress = patient_identifier?.find((identifier) => identifier?.identifier_type === IDENTIFIER_TYPES.ABHA_ADDRESS)?.identifier ?? '';
  const openMRSId = patient_identifier?.find((identifier) => identifier?.identifier_type === IDENTIFIER_TYPES.OPENMRS_ID)?.identifier ?? '';
  const careContexts = visits?.map((visit) => {
    return {
      "referenceNumber": visit?.uuid,
      "display": `${patient_name?.given_name} ${patient_name?.family_name} OpConsult-1 on ${convertDateToDDMMYYYY(visit?.date_started)}`,
      "hiType": "OPConsultation"
    }
  });

  return {
    "hipId": process.env.ABDM_INTELEHEALTH_ID,
    "abhaAddress": abhaAddress,
    "name": `${patient_name?.given_name ?? ''} ${patient_name?.family_name ?? ''}`,
    "gender": person?.gender,
    "dateOfBirth": person?.birthdate,
    "patientReference": openMRSId,
    "patientDisplay": `${patient_name?.given_name ?? ''} ${patient_name?.family_name ?? ''}`,
    "patientMobile": person?.attributes?.[0]?.value,
    "careContexts": careContexts,
  }
}
/**
 * Function to get the visit by abhaDetail
 * @param {object} param 
 * @returns visits array
 */
async function getVisitByAbhaDetails(whereParams) {
  const patientIdentifier = await patient_identifier.findOne({
    attributes: ['patient_id'],
    where: whereParams,
    logging: console.log
  });
  if (!patientIdentifier) return null;
  const data = await this.getVisitsByPatientId(patientIdentifier.patient_id, true);
  return {
    data: getFormatedResponse(data),
    patientInfo: data?.patientInfo
  }

}

/**
 * Function to get the visit by mobile number with gender and name validation
 * @param {object} params - Search parameters
 * @param {string} params.mobileNumber - Mobile number
 * @param {string} params.yearOfBirth - Year of birth
 * @param {string} params.gender - Gender
 * @param {string} params.name - Patient name
 * @param {string} params.openMRSId - Optional OpenMRS ID for additional validation
 * @returns visits array
 */
async function getVisitByMobile(params) {
  
  const { mobileNumber, yearOfBirth, gender, name, openMRSId } = params;
  
  // Get mobile number formats for flexible searching
  const mobileFormats = getMobileNumberFormats(mobileNumber);
  
  // Find person attributes by mobile number with optional OpenMRS ID validation
  const personAttributes = await findPersonAttributesByMobile(mobileFormats, openMRSId);
  if (!personAttributes?.length) {
    logStream('debug', 'No person attributes found for mobile number', 'getVisitByMobile');
    return null;
  }
  
  // Get birth date range if year of birth is provided
  const birthDateRange = yearOfBirth ? getBirthDateRange(yearOfBirth) : null;
  
  // Find persons matching criteria
  const persons = await findPersonsByCriteria({
    personIds: personAttributes.map(p => p.person_id),
    gender,
    birthDateRange
  });

  if (!persons?.length) {
    logStream('debug', 'No persons found matching criteria', 'getVisitByMobile');
    return null;
  }
  
  // Filter persons by name match
  const matchingPatientIds = filterPersonsByName(persons, name);
  
  if (!matchingPatientIds.length) {
    return null;
  }
  
  if (matchingPatientIds.length > 1) {
    return {
      success: false,
      message: 'Mobile number having multiple patient after matched with all date of birth, gender, family_name and given_name'
    };
  }
  
  // Get visits for the matching patient
  const data = await this.getVisitsByPatientId(matchingPatientIds[0]);
  return {
    data: getFormatedResponse(data),
    patientInfo: data?.patientInfo
  };
}

/**
 * Helper function to get mobile number formats (with and without country code)
 * @param {string} mobileNumber 
 * @returns {object} mobile number formats
 */
function getMobileNumberFormats(mobileNumber) {
  let withCountryCode = mobileNumber;
  let withoutCountryCode = mobileNumber;
  
  if (mobileNumber.includes('+91')) {
    withoutCountryCode = mobileNumber.replace('+91', '');
  } else if (!mobileNumber.includes('+91')) {
    withCountryCode = `+91${mobileNumber}`;
  }
  
  return { withCountryCode, withoutCountryCode };
}

/**
 * Helper function to find person attributes by mobile number with optional OpenMRS ID validation
 * @param {object} mobileFormats 
 * @param {string} openMRSId - Optional OpenMRS ID for additional validation
 * @returns {Array} person attributes
 */
async function findPersonAttributesByMobile(mobileFormats, openMRSId = null) {
  try {  // If OpenMRS ID is provided, use a more complex query with JOIN
    if (openMRSId) {
      const query = `
        SELECT DISTINCT pa.person_id 
        FROM person_attribute pa
        INNER JOIN patient p ON pa.person_id = p.patient_id
        INNER JOIN patient_identifier pi ON p.patient_id = pi.patient_id
        WHERE pa.person_attribute_type_id = :mobileType
          AND pa.value IN (:mobileValues)
          AND pi.identifier_type = :openmrsType
          AND pi.identifier = :openmrsId
          AND pa.voided = 0
          AND pi.voided = 0
          AND p.voided = 0
          AND pi.preferred = 1
        ORDER BY pi.date_changed DESC
      `;
      
      const results = await person_attribute.sequelize.query(query, {
        replacements: {
          mobileType: IDENTIFIER_TYPES.MOBILE_NUMBER,
          mobileValues: [mobileFormats.withoutCountryCode, mobileFormats.withCountryCode],
          openmrsType: IDENTIFIER_TYPES.OPENMRS_ID,
          openmrsId: openMRSId
        },
        type: person_attribute.sequelize.QueryTypes.SELECT,
        logging: console.log
      });
          
      return results.map(row => ({ person_id: row.person_id }));
    }

    const queryParams = {
      person_attribute_type_id: IDENTIFIER_TYPES.MOBILE_NUMBER,
      value: { 
        [Op.or]: [
          { [Op.eq]: mobileFormats.withoutCountryCode },
          { [Op.eq]: mobileFormats.withCountryCode }
        ]
      },
      voided: { [Op.eq]: 0 }
    };

    // Standard query without OpenMRS ID validation
    return await person_attribute.findAll({
      attributes: ["person_id"],
      where: queryParams,
      orderby: [["date_changed", "DESC"]],
      logging: console.log
    });
  } catch (error) {
    logStream('error', `Error finding person attributes by mobile number: ${error.message}`, 'findPersonAttributesByMobile');
    return [];
  }
}

/**
 * Helper function to get birth date range
 * @param {number} yearOfBirth 
 * @returns {object} date range
 */
function getBirthDateRange(yearOfBirth) {
  const currentDate = new Date();
  const startDate = new Date(currentDate.setFullYear(yearOfBirth - 5));
  const endDate = new Date(currentDate.setFullYear(Number(yearOfBirth) + 5));
  
  return {
    [Op.between]: [startDate, endDate]
  };
}

/**
 * Helper function to find persons by criteria
 * @param {object} criteria 
 * @returns {Array} persons
 */
async function findPersonsByCriteria(criteria) {
  const { personIds, gender, birthDateRange } = criteria;
  
  const where = {
    person_id: {
      [Op.in]: personIds
    },
    gender: { [Op.eq]: gender },
    voided: { [Op.eq]: 0 },
  };
  
  if (birthDateRange) {
    where.birthdate = birthDateRange;
  }

  return await person.findAll({
    attributes: ['person_id'],
    where: where,
    include: [
      {
        model: person_name,
        as: "person_name",
        attributes: ["given_name", "middle_name", "family_name"],
        where: {
          preferred: { [Op.eq]: 1 },
          voided: { [Op.eq]: 0 }
        }
      }
    ],
    orderby: [["date_changed", "DESC"]]
  });
}

/**
 * Helper function to filter persons by name match
 * @param {Array} persons 
 * @param {string} name 
 * @returns {Array} matching patient IDs
 */
function filterPersonsByName(persons, name) {
  return persons
    .filter(person => {
      const personName = person?.person_name;
      return personName && 
             name.includes(personName.given_name) && 
             name.includes(personName.family_name);
    })
    .map(person => person.person_id);
}

/**
 * Helper function to build ABHA identifiers array for search
 * @param {string} abhaNumber - ABHA number
 * @param {string} abhaAddress - ABHA address
 * @returns {Array} Array of ABHA identifiers to search
 */
function buildAbhaIdentifiersArray(abhaNumber, abhaAddress) {
  const identifiers = [];
  
  if (abhaNumber) {
    identifiers.push(abhaNumber);
  }
  
  if (abhaAddress) {
    // Add both with and without ABHA address suffix for flexible matching
    identifiers.push(abhaAddress.replace(process.env.ABHA_ADDRESS_SUFFIX, ''));
    identifiers.push(abhaAddress);
  }
  
  return identifiers;
}

/**
 * Helper function to build ABHA search query with optional OpenMRS ID validation
 * @param {Array} abhaIdentifiers - Array of ABHA identifiers to search
 * @param {string} openMRSId - Optional OpenMRS ID for additional validation
 * @returns {Object} Sequelize where clause
 */
function buildAbhaSearchQuery(abhaIdentifiers, openMRSId) {
  const baseQuery = {
    identifier: {
      [Op.or]: abhaIdentifiers
    },
    voided: { [Op.eq]: 0 }
  };

  // If OpenMRS ID is provided, add AND condition for additional validation
  if (openMRSId) {
    return {
      [Op.and]: [
        {
          identifier: {
            [Op.or]: abhaIdentifiers
          }
        },
        {
          identifier_type: { [Op.eq]: IDENTIFIER_TYPES.OPENMRS_ID },
          identifier: { [Op.eq]: openMRSId }
        }
      ],
      voided: { [Op.eq]: 0 },
      preferred: { [Op.eq]: 1 }
    };
  }

  return baseQuery;
}

/**
 * get patient information by patientId
 * @param {number} patientId
 * @returns patient
 */
async function getPatientInfo(patientId) {
  const patientInfo = await patient.findOne({
    where: { "patient_id": patientId },
    include: [
      {
        model: patient_identifier,
        as: "patient_identifier",
        attributes: ["identifier", "identifier_type", 'patient_identifier_id', 'location_id', 'creator'],
        where: {
          voided: { [Op.eq]: 0 }
        }
      },
      {
        model: person,
        as: "person",
        attributes: ["uuid", "gender", "birthdate"],
        include: [
          {
            model: person_name,
            as: "person_name",
            attributes: ["given_name", "family_name"],
            where: {
              voided: { [Op.eq]: 0 },
              preferred: { [Op.eq] : 1 } 
            }
          },
          {
            model: person_attribute,
            as: "attributes",
            attributes: ["value", "person_attribute_type_id"],
            where: {
              voided: { [Op.eq]: 0 },
              person_attribute_type_id: { [Op.eq]: IDENTIFIER_TYPES.MOBILE_NUMBER }
            },
            required: false,
          },
        ]
      }
    ]
  });
  return patientInfo;
}

module.exports = (function () {
  /**
  * Get patient & Visit
  * @param { string } visitUUID - Visit UUID
  */
  this.getVisitByUUID = async (visitUUID) => {
    try {
      const url = `/ws/rest/v1/visit/${visitUUID}?v=custom:(location:(display),uuid,display,startDatetime,dateCreated,stopDatetime,encounters:(display,uuid,encounterDatetime,encounterType:(display),obs:(display,uuid,value,obsDatetime,concept:(uuid,display,id)),encounterProviders:(display,provider:(uuid,providerId,attributes,person:(uuid,display,gender,age,dateCreated,dateChanged)))),patient:(uuid,dateCreated,dateChanged,identifiers:(identifier,identifierType:(name,uuid,display)),attributes,person:(display,gender,age,birthdate,preferredAddress:(cityVillage,address1,address2),preferredName:(givenName,middleName,familyName),attributes)),attributes)`;
      const visit = await openmrsAxiosInstance.get(url);
      return {
        success: true,
        code: 200,
        status: 200,
        data: visit?.data,
        message: "Visit retrived successfully!",
      };
    } catch (error) {
      return {
        success: false,
        status: error?.status ?? error?.response?.status ?? 500,
        code: error?.code,
        message: error.message,
      };
    }
  };

  /**
  * Update the visit attribute
  * @param { string } visitUUID - Visit UUID
  * @param { object } attributes -  Visit Attributes
  */
  this.postAttribute = async (visitUUID, attributes) => {
    try {
      if (!visitUUID) {
        throw new Error(
          "visitUUID is required."
        );
      }
      const visit = await openmrsAxiosInstance.post(`/ws/rest/v1/visit/${visitUUID}/attribute`, attributes);
      return {
        success: true,
        data: visit?.data,
        message: "Visit attribute updated successfully!",
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  };

  /**
   * Get visits by ABHA details and/or mobile number with optional OpenMRS ID validation
   * @param {Object} params - Search parameters
   * @param {string} params.mobileNumber - Patient mobile number
   * @param {string} params.abhaNumber - ABHA number
   * @param {string} params.abhaAddress - ABHA address
   * @param {string} params.openMRSId - OpenMRS ID for additional validation
   * @returns {Object} Patient visit data or error response
   */
  this.getVisitBySearch = async (params) => {
    try {
      const { mobileNumber, abhaNumber, abhaAddress, openMRSId } = params;
      
      // Build ABHA identifiers array for search
      const abhaIdentifiers = buildAbhaIdentifiersArray(abhaNumber, abhaAddress);
      
      let response = null;
      
      // Primary search: ABHA details (with optional OpenMRS ID validation)
      if (abhaIdentifiers.length > 0) {
        const whereParams = buildAbhaSearchQuery(abhaIdentifiers, openMRSId);
        response = await getVisitByAbhaDetails(whereParams);
      }
      
      // Fallback search: Mobile number if ABHA search didn't yield results
      if (!response?.data && mobileNumber) {
        response = await getVisitByMobile(params);
        
        // Handle multiple patients found scenario
        if (response?.success === false) {
          return {
            ...response,
            hasMultiplePatient: true
          };
        }
      }
      
      return response;
    } catch (err) {
      throw err;
    }
  };

  /**
   * @param {number} patientId 
   * @param {boolean} hasAbhaDetail
   * @returns - patient visits
   */
  this.getVisitsByPatientId = async (patientId, hasAbhaDetail = false) => {
    const patientInfo = await getPatientInfo(patientId);
    const query = {
      where: {
        patient_id: { [Op.eq]: patientId },
        voided: { [Op.eq]: 0 },
      },
      attributes: ["uuid", "date_started"],
      include: [
        {
          model: encounter,
          as: "encounters",
          attributes: ["encounter_type", "encounter_datetime", 'uuid'],
          where: {
            [Op.or]: [{
              encounter_type: {
                [Op.eq]: 14
              }
            },
            {
              encounter_type: {
                [Op.eq]: 12
              }
            }]
          },
        }
      ],
      order: [["visit_id", "DESC"]]
    };

    if (hasAbhaDetail) {
      query.include.push({
        model: visit_attribute,
        as: "attributes",
        attributes: ["attribute_type_id", "value_reference", "voided"],
        where: {
          attribute_type_id: { [Op.eq]: VISIT_ATTRIBUTE_TYPES.IS_ABDM_LINKED },
          value_reference: { [Op.eq]: false },
          voided: { [Op.eq]: 0 },
        }
      })
    }

    const visits = await visit.findAll(query, { logging: console.log });
    return { visits: visits?.length ? visits : null, patientInfo: patientInfo };
  };

  this.getDocument = async (documentUUID) => {
    try {
      const document = await openmrsAxiosInstance.get(`/ws/rest/v1/obs/${documentUUID}/value`, { responseType: 'arraybuffer' }).then(res => convertToBase64(res));
      return document;
    } catch (error) {
      return null;
    }
  };

  /**
   * Update patient ABHA details and visit attributes
   * @param {Object} response - Patient discovery response
   * @param {string} abhaAddress - ABHA address
   * @param {string} abhaNumber - ABHA number
   */
  this.updatePatientAndVisitData = async (response, abhaAddress, abhaNumber) => {
    try {
      const patientUUID = response?.patientInfo?.patient_id;
      const hasAbhaData = Boolean(abhaAddress) || Boolean(abhaNumber);
      
      // Update patient ABHA details (only if patient exists and has ABHA data)
      if (patientUUID && hasAbhaData) {
        const abhaUpdateResult = await this.updatePatientAbhaDetails(response.patientInfo, {
          abhaAddress,
          abhaNumber
        });

        if (!abhaUpdateResult) {
          logStream("warn", "Failed to update patient ABHA details", "updatePatientAndVisitData");
        } else {
          logStream("info", "Patient ABHA details updated successfully", "updatePatientAndVisitData");
        }
      } else if (patientUUID && !hasAbhaData) {
        logStream("debug", "Skipping ABHA details update - no ABHA data provided", "updatePatientAndVisitData");
      }

      // Update visit attributes for care contexts (always execute if care contexts exist)
      // const careContexts = response?.data?.careContexts;
      // if (careContexts?.length) {
      //   const visitUpdateResult = await this.updateVisitAttributes(
      //     careContexts, 
      //     VISIT_ATTRIBUTE_TYPES.IS_ABDM_LINKED, 
      //     true
      //   );

      //   if (visitUpdateResult?.success) {
      //     logStream("info", `Visit attributes updated: ${visitUpdateResult.processed} updated, ${visitUpdateResult.skipped} skipped`, "updatePatientAndVisitData");
      //   } else {
      //     logStream("warn", `Visit attributes update failed: ${visitUpdateResult?.message}`, "updatePatientAndVisitData");
      //   }
      // } else {
      //   logStream("debug", "No care contexts found - skipping visit attributes update", "updatePatientAndVisitData");
      // }

    } catch (error) {
      logStream("error", `Failed to update patient and visit data: ${error.message}`, "updatePatientAndVisitData");
    }
  };

  this.updatePatientAbhaDetails = async (patientInfo, abhaDetails) => {
    const { abhaNumber, abhaAddress } = abhaDetails || {};
    
    if (!abhaNumber && !abhaAddress) {
      logStream("warn", "No ABHA details provided for update", "updatePatientAbhaDetails");
      return true;
    }

    // Extract existing identifiers
    const existingIdentifiers = patientInfo?.patient_identifier || [];
    const existingAbhaNumberIdentifier = existingIdentifiers.find(id => id.identifier_type === IDENTIFIER_TYPES.ABHA_NUMBER);
    const existingAbhaAddressIdentifier = existingIdentifiers.find(id => id.identifier_type === IDENTIFIER_TYPES.ABHA_ADDRESS);
    const openMRSIdentifier = existingIdentifiers.find(id => id.identifier_type === IDENTIFIER_TYPES.OPENMRS_ID);

    try {
      // Define identifier configurations
      const identifierConfigs = [
        {
          type: IDENTIFIER_TYPES.ABHA_NUMBER,
          value: abhaNumber,
          existing: existingAbhaNumberIdentifier,
          name: 'ABHA Number',
          location_id: openMRSIdentifier?.location_id ?? existingAbhaNumberIdentifier.location_id ?? 1,
          creator: openMRSIdentifier?.creator ?? existingAbhaNumberIdentifier.creator ?? 1
        },
        {
          type: IDENTIFIER_TYPES.ABHA_ADDRESS,
          value: abhaAddress,
          existing: existingAbhaAddressIdentifier,
          name: 'ABHA Address',
          location_id: openMRSIdentifier?.location_id ?? existingAbhaAddressIdentifier.location_id ?? 1,
          creator: openMRSIdentifier?.creator ?? existingAbhaAddressIdentifier.creator ?? 1
        }
      ];
      // Process each identifier
      const updatePromises = identifierConfigs
        .filter(config => config.value) // Only process if value exists
        .map(async (config) => {
          const { type, value, existing, name, location_id, creator } = config;
          
          if (existing?.identifier === value && existing?.location_id === location_id && existing?.creator === creator) {
            logStream("debug", `${name} already matches, skipping update`, "updatePatientAbhaDetails");
            return;
          }

          try {
            if (existing) {
              // Update existing identifier
              await patient_identifier.update({
                identifier: value,
                creator: creator,
                location_id: location_id,
                date_changed: new Date(),
                where: {
                  patient_identifier_id: existing.patient_identifier_id
                },
                logging: console.log
              });
              logStream("info", `${name} updated successfully`, "updatePatientAbhaDetails");
            } else {
              // Create new identifier
              await patient_identifier.create({
                patient_id: patientInfo.patient_id,
                identifier: value,
                identifier_type: type,
                location_id: location_id,
                date_created: new Date(),
                date_changed: new Date(),
                uuid: uuid(),
                creator: creator
              });
              logStream("info", `${name} created successfully`, "updatePatientAbhaDetails");
            }
          } catch (error) {
            logStream("error", `Failed to ${existing ? 'update' : 'create'} ${name}: ${error.message}`, "updatePatientAbhaDetails");
            throw error;
          }
        });

      // Wait for all updates to complete
      await Promise.all(updatePromises);
      
      logStream("info", "ABHA details updated successfully", "updatePatientAbhaDetails");
      return true;
      
    } catch (error) {
      logStream("error", `Failed to update ABHA details: ${error.message}`, "updatePatientAbhaDetails");
      return false;
    }
  }

  /**
   * Update visit attributes for multiple visits from care contexts
   * @param {Array} careContexts - Array of care context objects with referenceNumber
   * @param {number} attributeTypeId - Attribute type ID to update
   * @param {string|boolean|number} value - Value to set for the attribute
   * @returns {Object} Result object with success status and details
   */
  this.updateVisitAttributes = async (careContexts, attributeTypeId, value) => {
    try {
      const visitUUIDs = careContexts.map(context => context.referenceNumber);
      if (!visitUUIDs.length || !attributeTypeId || value === undefined) {
        logStream("warn", "Missing required parameters: visitUUIDs, attributeTypeId, and value", "updateVisitAttributes"); 
        return { success: false, message: "Missing required parameters" };
      }

      const stringValue = String(value);
      const parsedAttributeTypeId = parseInt(attributeTypeId);
      const now = new Date();

      // Get all visit IDs in one query
      const visitRecords = await visit.findAll({
        where: { uuid: { [Op.in]: visitUUIDs } },
        attributes: ['visit_id', 'uuid']
      });

      const foundVisitIds = visitRecords.map(v => v.visit_id);

      // Check existing attributes in bulk
      const existingAttributes = await visit_attribute.findAll({
        where: {
          visit_id: { [Op.in]: foundVisitIds },
          attribute_type_id: parsedAttributeTypeId
        },
        attributes: ['visit_id', 'value_reference']
      });

      const existingMap = new Map(existingAttributes.map(attr => [attr.visit_id, attr.value_reference]));

      // Separate visits that need updates vs those that are already correct
      const visitsToUpdate = [];
      const visitsToSkip = [];
      const visitUuidMap = new Map(visitRecords.map(v => [v.visit_id, v.uuid]));

      for (const visitRecord of visitRecords) {
        const existingValue = existingMap.get(visitRecord.visit_id);
        if (existingValue && String(existingValue) === stringValue) {
          visitsToSkip.push(visitRecord.uuid);
        } else {
          visitsToUpdate.push(visitRecord.visit_id);
        }
      }

      // Process updates in parallel if there are any
      if (visitsToUpdate.length > 0) {
        const updatePromises = [];
        
        // Get existing visit IDs that need updates
        const existingVisitIds = existingAttributes
          .filter(attr => visitsToUpdate.includes(attr.visit_id))
          .map(attr => attr.visit_id);

        // Bulk update existing attributes
        if (existingVisitIds.length > 0) {
          updatePromises.push(
            visit_attribute.update(
              { 
                value_reference: stringValue,
                date_changed: now
              },
              {
                where: {
                  visit_id: { [Op.in]: existingVisitIds },
                  attribute_type_id: parsedAttributeTypeId
                }
              }
            )
          );
        }

        // Bulk create new attributes for visits that don't have them
        const newVisitIds = visitsToUpdate.filter(id => !existingVisitIds.includes(id));
        if (newVisitIds.length > 0) {
          const newAttributes = newVisitIds.map(visitId => ({
            visit_id: visitId,
            attribute_type_id: parsedAttributeTypeId,
            value_reference: stringValue,
            uuid: uuid(),
            creator: 1,
            date_created: now,
            date_changed: now,
          }));

          updatePromises.push(visit_attribute.bulkCreate(newAttributes));
        }

        // Execute all updates in parallel
        await Promise.all(updatePromises);
      }

      const results = {
        success: true,
        processed: visitsToUpdate.length,
        skipped: visitsToSkip.length,
        failed: 0,
        details: [
          ...visitsToUpdate.map(visitId => ({ 
            visitUuid: visitUuidMap.get(visitId), 
            status: 'updated', 
            message: 'Successfully updated' 
          })),
          ...visitsToSkip.map(uuid => ({ 
            visitUuid: uuid, 
            status: 'skipped', 
            message: 'Value already exists' 
          }))
        ]
      };

      logStream("info", `Visit attributes update completed: ${results.processed} updated, ${results.skipped} skipped`, "updateVisitAttributes");
      return results;
      
    } catch (error) {
      logStream("error", `Failed to update visit attributes: ${error.message}`, "updateVisitAttributes");
      return { success: false, message: error.message };
    }
  }
  return this;
})();
