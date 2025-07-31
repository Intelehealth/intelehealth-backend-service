const { uuid } = require('uuidv4');
const { openmrsAxiosInstance } = require('../handlers/axiosHelper');
const { convertDateToDDMMYYYY, convertToBase64 } = require('../handlers/utilityHelper');
const { logStream } = require('../logger');
const { patient_identifier, visit, Sequelize, encounter, person_name, person, person_attribute, visit_attribute, patient } = require('../openmrs_models');
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
  const abhaAddress = patient_identifier?.find((identifier) => identifier?.identifier_type === 7)?.identifier ?? '';
  const openMRSId = patient_identifier?.find((identifier) => identifier?.identifier_type === 3)?.identifier ?? '';
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
    where: whereParams
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
 * @param {object} param 
 * @returns visits array
 */
async function getVisitByMobile(params) {
  
  const { mobileNumber, yearOfBirth, gender, name } = params;
  
  // Get mobile number formats for flexible searching
  const mobileFormats = getMobileNumberFormats(mobileNumber);
  
  // Find person attributes by mobile number
  const personAttributes = await findPersonAttributesByMobile(mobileFormats);
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
  } else if (!mobileNumber.includes('91')) {
    withCountryCode = `+91${mobileNumber}`;
  }
  
  return { withCountryCode, withoutCountryCode };
}

/**
 * Helper function to find person attributes by mobile number
 * @param {object} mobileFormats 
 * @returns {Array} person attributes
 */
async function findPersonAttributesByMobile(mobileFormats) {
  const queryParams = {
    person_attribute_type_id: 8,
    value: { 
      [Op.or]: [
        { [Op.eq]: mobileFormats.withoutCountryCode },
        { [Op.eq]: mobileFormats.withCountryCode }
      ]
    }
  };
  
  return await person_attribute.findAll({
    attributes: ["person_id"],
    where: queryParams
  });
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
    gender: { [Op.eq]: gender }
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
          preferred: { [Op.eq]: 1 }
        }
      }
    ]
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
        attributes: ["identifier", "identifier_type", 'patient_identifier_id'],
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
              preferred: { [Op.eq] : 1 } 
            }
          },
          {
            model: person_attribute,
            as: "attributes",
            attributes: ["value", "person_attribute_type_id"],
            where: {
              "person_attribute_type_id": { [Op.eq]: 8 }
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
   * Get visits by abhaAddress and mobile numbers
   * @param { object } params
   */
  this.getVisitBySearch = async (params) => {
    try {
      const { mobileNumber, abhaNumber, abhaAddress } = params;
     
      const or = []
      if (abhaNumber) {
        or.push(abhaNumber);
      }
      if (abhaAddress) {
        or.push(abhaAddress.replace(process.env.ABHA_ADDRESS_SUFFIX, ''));
        or.push(abhaAddress);
      }
      let response = null;
      if (or.length) {
        response = await getVisitByAbhaDetails({
          identifier: {
            [Op.or]: or
          }
        })
      } 
      if (!response?.data && mobileNumber) {
        response = await getVisitByMobile(params);
        if(response?.success === false) return {
          ...response,
          hasMultiplePatient: true
        };
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
        attributes: ["attribute_type_id", "value_reference"],
        where: {
          "attribute_type_id": { [Op.eq]: 10 },
          "value_reference": { [Op.eq]: false }
        }
      })
    }

    const visits = await visit.findAll(query);
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

  this.updatePatientAbhaDetails = async (patientInfo, abhaDetails) => {
    const { abhaNumber, abhaAddress } = abhaDetails || {};
    
    if (!abhaNumber && !abhaAddress) {
      logStream("warn", "No ABHA details provided for update", "updatePatientAbhaDetails");
      return true;
    }

    // Extract existing identifiers
    const existingIdentifiers = patientInfo?.patient_identifier || [];
    const existingAbhaNumberIdentifier = existingIdentifiers.find(id => id.identifier_type === 6);
    const existingAbhaAddressIdentifier = existingIdentifiers.find(id => id.identifier_type === 7);

    try {
      // Define identifier configurations
      const identifierConfigs = [
        {
          type: 6,
          value: abhaNumber,
          existing: existingAbhaNumberIdentifier,
          name: 'ABHA Number'
        },
        {
          type: 7,
          value: abhaAddress,
          existing: existingAbhaAddressIdentifier,
          name: 'ABHA Address'
        }
      ];

      // Process each identifier
      const updatePromises = identifierConfigs
        .filter(config => config.value) // Only process if value exists
        .map(async (config) => {
          const { type, value, existing, name } = config;
          
          if (existing?.identifier === value) {
            logStream("debug", `${name} already matches, skipping update`, "updatePatientAbhaDetails");
            return;
          }

          try {
            if (existing) {
              // Update existing identifier
              await patient_identifier.update({
                identifier: value,
                date_changed: new Date()
              }, {
                where: {
                  patient_identifier_id: existing.patient_identifier_id
                }
              });
              logStream("info", `${name} updated successfully`, "updatePatientAbhaDetails");
            } else {
              // Create new identifier
              await patient_identifier.create({
                patient_id: patientInfo.patient_id,
                identifier: value,
                identifier_type: type,
                location_id: 1,
                preferred: false,
                date_created: new Date(),
                date_changed: new Date(),
                uuid: uuid(),
                creator: 1
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
  return this;
})();
