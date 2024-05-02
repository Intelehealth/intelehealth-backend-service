const { convertDateToDDMMYYYY } = require('../handlers/utilityHelper');
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
      "display": `${patient_name?.given_name} ${patient_name?.family_name} OpConsult-1 on ${convertDateToDDMMYYYY(visit?.date_started)}`
    }
  });

  return {
    "abhaAddress": abhaAddress,
    "name": `${patient_name?.given_name ?? ''} ${patient_name?.family_name ?? ''}`,
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
  return getFormatedResponse(data);

}

/**
 * Function to get the visit by mobile number with gender and name validation
 * @param {object} param 
 * @returns visits array
 */
async function getVisitByMobile({ mobileNumber, yearOfBirth, gender, name }) {
  const currentDate = new Date();
  const startDate = currentDate.setFullYear(yearOfBirth - 5)
  const endDate = yearOfBirth ? currentDate.setFullYear(Number(yearOfBirth) + 5) : currentDate.setFullYear((new Date()).getFullYear() + 5)
  const personAttributes = await person_attribute.findAll({
    attributes: ["person_id"],
    where: {
      person_attribute_type_id: { [Op.eq]: 8 },
      value: { [Op.eq]: mobileNumber }
    },
    // include: [
    //   {
    //     model: person,
    //     as: "person",
    //     attributes: ["person_id", "gender", "birthdate"],
    //     where: {
    //       birthdate: {
    //         [Op.between]: [startDate, endDate]
    //       },
    //       gender: { [Op.eq]: gender }
    //     },
    //     include: [
    //       {
    //         model: person_name,
    //         as: "person_name",
    //         attributes: ["given_name", "middle_name", "family_name"],
    //       }
    //     ]
    //   }
    // ],
    // order: [["person_id", "DESC"]],
  });

  if (!personAttributes?.length) {
    logStream('debug', 'person_attribute.findAll no data not found based on mobile number', 'getVisitByMobile')
    return null;
  }

  const where = {
    person_id: {
      [Op.in]: personAttributes?.map((p) => p.person_id)
    },
    gender: { [Op.eq]: gender }
  };

  if (yearOfBirth) {
    where.birthdate = {
      [Op.between]: [startDate, endDate]
    }
  }
  const persons = await person.findAll({
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
    ],
  })

  if (!persons?.length) {
    logStream('debug', 'person.findAll no data not found based on mobile number', 'getVisitByMobile')
    return null;
  }

  const patientIds = [];
  for (let i = 0; i < persons?.length; i++) {
    const person = persons[i];
    if (name.includes(person?.person_name?.given_name) && name.includes(person?.person_name?.family_name)) {
      patientIds.push(person.person_id);
    }
  }

  if(!patientIds.length) return null;
  if (patientIds.length > 1) return {
    success: false,
    message: 'Mobile number having multiple patient after matched with all date of birth, gender, family_name and given_name'
  };

  const data = await this.getVisitsByPatientId(patientIds[0]);
  return getFormatedResponse(data);
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
        attributes: ["identifier", "identifier_type"],
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
      const url = `/ws/rest/v1/visit/${visitUUID}?v=custom:(location:(display),uuid,display,startDatetime,dateCreated,stopDatetime,encounters:(display,uuid,encounterDatetime,encounterType:(display),obs:(display,uuid,value,concept:(uuid,display)),encounterProviders:(display,provider:(uuid,providerId,attributes,person:(uuid,display,gender,age)))),patient:(uuid,identifiers:(identifier,identifierType:(name,uuid,display)),attributes,person:(display,gender,age)),attributes)`;
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
        status: error?.status ?? 500,
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
      let mobileNumber = params?.verifiedIdentifiers.find((v) => v.type?.toUpperCase() === 'MOBILE')?.value;
      const abhaNumber = params?.verifiedIdentifiers.find((v) => v.type === 'NDHM_HEALTH_NUMBER')?.value;
      const abhaAddress = params?.id ?? params?.verifiedIdentifiers.find((v) => v.type === 'HEALTH_ID')?.value ?? (abhaNumber ? `${abhaNumber.replace(/-/g, '')}@sbx` : undefined);
      const or = []
      if (abhaNumber) {
        or.push(abhaNumber);
      }
      if (abhaAddress) {
        or.push(abhaAddress);
      }
      let patientInfo = null;
      if (or.length) {
        patientInfo = await getVisitByAbhaDetails({
          identifier: {
            [Op.or]: or
          }
        })
      } else if (mobileNumber) {
        if (!mobileNumber.includes('+91')) {
          mobileNumber = `+91${mobileNumber}`;
        }
        patientInfo = await getVisitByMobile({ ...params, mobileNumber });
        if(patientInfo?.success === false) return {
          ...patientInfo,
          hasMultiplePatient: true
        };
      }
      return patientInfo;
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
  return this;
})();
