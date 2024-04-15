const { patient_identifier, visit, Sequelize, encounter, person_name, person, person_attribute } = require('../openmrs_models');
const { Op } = Sequelize;

function getFormatedResponse(visits) {
  if(!visits) return [];
  const patient_identifier = visits[0].patient_identifier;
  const person = visits[0].person;
  const patient_name = visits[0].patient_name;
  const abhaAddress = patient_identifier?.find((identifier) => identifier?.identifier_type === 7)?.identifier ?? '';
  const openMRSId = patient_identifier?.find((identifier) => identifier?.identifier_type === 3)?.identifier ?? '';
console.log(JSON.stringify(visits, null, 4))
  const careContexts = visits?.map((visit) => {
    return {
      "referenceNumber": visit?.encounters?.[0]?.uuid,
      "display": `OpConsult-1:${patient_name?.given_name} ${patient_name?.family_name}:${visit?.date_started}`
    }
  });
  
  return {
    "abhaAddress": abhaAddress,
    "name": `${patient_name?.given_name} ${patient_name?.family_name}`,
    "gender": person?.gender,
    "dateOfBirth": person?.birthdate,
    "patientReference": openMRSId,
    "patientDisplay": patient_name?.given_name,
    "patientMobile": person?.attributes?.[0]?.value,
    "careContexts": careContexts,
  }
} 

module.exports = (function () {
  /**
  * Get patient & Visit
  * @param { string } visitUUID - Visit UUID
  */
  this.getVisitByUUID = async (visitUUID) => {
    try {
      if (!visitUUID) {
        throw new Error(
          "visitUUID is required."
        );
      }

      const url = `/ws/rest/v1/visit/${visitUUID}?v=custom:(location:(display),uuid,display,startDatetime,dateCreated,stopDatetime,encounters:(display,uuid,encounterDatetime,encounterType:(display),obs:(display,uuid,value,concept:(uuid,display)),encounterProviders:(display,provider:(uuid,attributes,person:(uuid,display,gender,age)))),patient:(uuid,identifiers:(identifier,identifierType:(name,uuid,display)),attributes,person:(display,gender,age)),attributes)`;
      const visit = await openmrsAxiosInstance.get(url);

      return {
        success: true,
        data: visit?.data,
        message: "Visit retrived successfully!",
      };
    } catch (error) {
      return {
        success: false,
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
   */
  this.getVisitBySearch = async (params) => {
    try {
      const mobileNumber = params?.verifiedIdentifiers.find((v) => v.type === 'Mobile')?.value

      const or = []
      if (params.abhaNumber) {
        or.push(params.abhaNumber);
      }
      if (params.abhaAddress) {
        or.push(params.abhaAddress);
      }
      const patientIdentifier = await patient_identifier.findOne({
        attributes: ['patient_id'],
        where: {
          identifier: {
            [Op.or]: or
          }
        }
      });

      let visits = null;
      if (patientIdentifier) {
        visits = await this.getVisitsByPatientId(patientIdentifier.patient_id);
        return getFormatedResponse(visits);
      }

      // if (mobileNumber) {
      //   $where.$or.push({
      //     identifier: {
      //       $eq: mobileNumber
      //     }
      //   })
      // }

      // const personAttributes = await person_attributes.findOne({
      //   where: $where,
      //   include: [
      //     {
      //       model: person,
      //       as: "person",
      //       attributes: ["uuid", "gender", "birthdate"],
      //     },
      //   ]
      // });
      
    } catch (err) {
      console.log(err)
      return null;
    }
  };
  this.getVisitsByPatientId = async (patientId) => {
    const visits = await visit.findAll({
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
        },
        {
          model: patient_identifier,
          as: "patient_identifier",
          attributes: ["identifier", "identifier_type"],
        },
        {
          model: person_name,
          as: "patient_name",
          attributes: ["given_name", "family_name"],
        },
        {
          model: person,
          as: "person",
          attributes: ["uuid", "gender", "birthdate"],
          include: [
            {
              model: person_attribute,
              as: "attributes",
              attributes: ["value", "person_attribute_type_id"],
              where: {
                "person_attribute_type_id": {[Op.eq] : 8 }
              },
              required: false,
            },
          ]
        },
      ],
      order: [["visit_id", "DESC"]]
    });
    if (visits) return visits;
    return null;
  };
  return this;
})();
