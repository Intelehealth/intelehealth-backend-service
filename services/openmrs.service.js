const {
  visit,
  encounter,
  patient_identifier,
  person_name,
  encounter_type,
  encounter_provider,
  person,
  provider,
  concept,
  location,
  visit_attribute,
  visit_attribute_type,
  obs,
  Sequelize,
} = require("../openmrs_models");
const Op = Sequelize.Op;

module.exports = (function () {
  /**
   * Encounter type
   * 1 - ADULTINITIAL
   * 6 - Vitals
   * 9 - Visit Note
   * 12 - Patient Exit Survey
   * 14 - Visit Complete
   * 15 - Flagged
   */
  this._getAwaitingVisits = async (state, speciality) => {
    try {
      const otherVisitIds = await visit.findAll({
        required: true,
        attributes: ["visit_id"],
        where: {
          "$encounters.encounter_type$": { [Op.in]: [9, 12, 15] },
          voided: false,
        },
        include: [
          {
            required: true,
            model: encounter,
            as: "encounters",
            attributes: ["encounter_type"],
          },
        ],
      });

      const otherThanAwaiting = otherVisitIds.map((visit) => visit?.visit_id);

      const visits = await visit.findAll({
        where: {
          visit_id: { [Op.notIn]: otherThanAwaiting },
          voided: false,
        },
        attributes: ["visit_id", "uuid"],
        include: [
          {
            required: true,
            model: encounter,
            as: "encounters",
            attributes: ["encounter_datetime"],
            include: [
              {
                model: obs,
                as: "obs",
                attributes: ["value_text"],
                where: {
                  value_text: { [Op.ne]: null },
                  concept_id: 163212,
                },
                // include: [
                //   {
                //     model: concept,
                //     as: "concept",
                //   },
                // ],
              },
              {
                required: true,
                model: encounter_type,
                as: "type",
                attributes: ["name"],
              },
              {
                required: true,
                model: encounter_provider,
                as: "encounter_provider",
                attributes: ["uuid"],
                include: [
                  {
                    model: provider,
                    as: "provider",
                    attributes: ["identifier", "uuid"],
                    include: [
                      {
                        model: person,
                        as: "person",
                        attributes: ["gender"],
                        include: [
                          {
                            model: person_name,
                            as: "person_name",
                            attributes: ["given_name", "family_name"],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            required: true,
            model: visit_attribute,
            as: "attributes",
            attributes: ["value_reference"],
            include: [
              {
                required: true,
                model: visit_attribute_type,
                as: "attribute_type",
                attributes: ["name"],
                where: {
                  name: { [Op.in]: ["Visit State", "Visit Speciality"] },
                },
              },
            ],
          },
          {
            model: patient_identifier,
            as: "patient",
            attributes: ["identifier"],
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
          },
          {
            model: location,
            as: "location",
            attributes: [
              "name",
              ["city_village", "village"],
              ["state_province", "state"],
            ],
          },
        ],
        order: [["visit_id", "DESC"]],
      });

      const filteredVisits = visits.filter((visit) => {
        const visitState = visit?.attributes?.find(
          (attr) => attr?.attribute_type?.name === "Visit State"
        );
        const visitSpeciality = visit?.attributes?.find(
          (attr) => attr?.attribute_type?.name === "Visit Speciality"
        );

        if (state === "All") {
          return visitSpeciality?.value_reference === speciality;
        } else {
          return (
            visitState?.value_reference === state &&
            visitSpeciality?.value_reference === speciality
          );
        }
      });
      return filteredVisits;
    } catch (error) {
      throw error;
    }
  };

  this._getPriorityVisits = async (state, speciality) => {
    try {
      const otherVisitIds = await visit.findAll({
        required: true,
        attributes: ["visit_id"],
        where: {
          "$encounters.encounter_type$": { [Op.in]: [9, 12, 14] },
          voided: false,
        },
        include: [
          {
            required: true,
            model: encounter,
            as: "encounters",
            attributes: ["encounter_type"],
          },
        ],
      });

      const otherThanAwaiting = otherVisitIds.map((visit) => visit?.visit_id);

      const visits = await visit.findAll({
        where: {
          visit_id: { [Op.notIn]: otherThanAwaiting },
          voided: false,
        },
        attributes: ["visit_id", "uuid"],
        include: [
          {
            model: encounter,
            as: "encounters",
            attributes: ["encounter_datetime", "encounter_id"],
            include: [
              {
                model: obs,
                as: "obs",
                attributes: ["value_text", "concept_id"],
                // where: {
                //   value_text: { [Op.ne]: null },
                //   concept_id: 163212,
                // },
              },
              {
                model: encounter_type,
                as: "type",
                attributes: ["name"],
              },
              {
                model: encounter_provider,
                as: "encounter_provider",
                attributes: ["uuid"],
                include: [
                  {
                    model: provider,
                    as: "provider",
                    attributes: ["identifier", "uuid"],
                    include: [
                      {
                        model: person,
                        as: "person",
                        attributes: ["gender"],
                        include: [
                          {
                            model: person_name,
                            as: "person_name",
                            attributes: ["given_name", "family_name"],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            model: visit_attribute,
            as: "attributes",
            attributes: ["value_reference"],
            include: [
              {
                model: visit_attribute_type,
                as: "attribute_type",
                attributes: ["name"],
                where: {
                  name: { [Op.in]: ["Visit State", "Visit Speciality"] },
                },
              },
            ],
          },
          {
            model: patient_identifier,
            as: "patient",
            attributes: ["identifier"],
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
          },
          {
            model: location,
            as: "location",
            attributes: [
              "name",
              ["city_village", "village"],
              ["state_province", "state"],
            ],
          },
        ],
        order: [["visit_id", "DESC"]],
      });

      const filteredVisits = visits.filter((visit) => {
        const priority = visit.encounters.find(
          (enc) => enc?.type?.name === "Flagged"
        );
        const visitState = visit?.attributes?.find(
          (attr) => attr?.attribute_type?.name === "Visit State"
        );
        const visitSpeciality = visit?.attributes?.find(
          (attr) => attr?.attribute_type?.name === "Visit Speciality"
        );

        if (state === "All") {
          return visitSpeciality?.value_reference === speciality && !!priority;
        } else {
          return (
            visitState?.value_reference === state &&
            visitSpeciality?.value_reference === speciality &&
            !!priority
          );
        }
      });
      return filteredVisits;
    } catch (error) {
      throw error;
    }
  };

  this._getInProgressVisits = async (state, speciality) => {
    try {
      const otherVisitIds = await visit.findAll({
        required: true,
        attributes: ["visit_id"],
        where: {
          "$encounters.encounter_type$": { [Op.in]: [12, 14] },
          voided: false,
        },
        include: [
          {
            required: true,
            model: encounter,
            as: "encounters",
            attributes: ["encounter_type"],
          },
        ],
      });

      const otherThanAwaiting = otherVisitIds.map((visit) => visit?.visit_id);

      const visits = await visit.findAll({
        where: {
          visit_id: { [Op.notIn]: otherThanAwaiting },
          voided: false,
        },
        attributes: ["visit_id", "uuid"],
        include: [
          {
            model: encounter,
            as: "encounters",
            attributes: ["encounter_datetime"],
            include: [
              {
                model: obs,
                as: "obs",
                attributes: ["value_text", "concept_id"],
              },
              {
                model: encounter_type,
                as: "type",
                attributes: ["name"],
              },
              {
                model: encounter_provider,
                as: "encounter_provider",
                attributes: ["uuid"],
                include: [
                  {
                    model: provider,
                    as: "provider",
                    attributes: ["identifier", "uuid"],
                    include: [
                      {
                        model: person,
                        as: "person",
                        attributes: ["gender"],
                        include: [
                          {
                            model: person_name,
                            as: "person_name",
                            attributes: ["given_name", "family_name"],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            model: visit_attribute,
            as: "attributes",
            attributes: ["value_reference"],
            include: [
              {
                model: visit_attribute_type,
                as: "attribute_type",
                attributes: ["name"],
                where: {
                  name: { [Op.in]: ["Visit State", "Visit Speciality"] },
                },
              },
            ],
          },
          {
            model: patient_identifier,
            as: "patient",
            attributes: ["identifier"],
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
          },
          {
            model: location,
            as: "location",
            attributes: [
              "name",
              ["city_village", "village"],
              ["state_province", "state"],
            ],
          },
        ],
        order: [["visit_id", "DESC"]],
      });

      const filteredVisits = visits.filter((visit) => {
        const visitNote = visit.encounters.find(
          (enc) => enc?.type?.name === "Visit Note"
        );

        const visitState = visit?.attributes?.find(
          (attr) => attr?.attribute_type?.name === "Visit State"
        );
        const visitSpeciality = visit?.attributes?.find(
          (attr) => attr?.attribute_type?.name === "Visit Speciality"
        );

        if (state === "All") {
          return visitSpeciality?.value_reference === speciality && !!visitNote;
        } else {
          return (
            visitState?.value_reference === state &&
            visitSpeciality?.value_reference === speciality &&
            !!visitNote
          );
        }
      });
      return filteredVisits;
    } catch (error) {
      throw error;
    }
  };

  this._getCompletedVisits = async (state, speciality) => {
    try {
      const otherVisitIds = await visit.findAll({
        required: true,
        attributes: ["visit_id"],
        where: {
          "$encounters.encounter_type$": { [Op.in]: [12, 14] },
          voided: false,
        },
        include: [
          {
            required: true,
            model: encounter,
            as: "encounters",
            attributes: ["encounter_type"],
          },
        ],
      });

      const visits = await visit.findAll({
        where: {
          visit_id: { [Op.notIn]: otherVisitIds },
          // "$encounters.encounter_type$": { [Op.in]: [14] },
          voided: false,
        },
        attributes: ["visit_id", "uuid"],
        include: [
          {
            model: encounter,
            as: "encounters",
            attributes: ["encounter_datetime"],
            include: [
              {
                model: obs,
                as: "obs",
                attributes: ["value_text", "concept_id"],
              },
              {
                model: encounter_type,
                as: "type",
                attributes: ["name"],
              },
              {
                model: encounter_provider,
                as: "encounter_provider",
                attributes: ["uuid"],
                include: [
                  {
                    model: provider,
                    as: "provider",
                    attributes: ["identifier", "uuid"],
                    include: [
                      {
                        model: person,
                        as: "person",
                        attributes: ["gender"],
                        include: [
                          {
                            model: person_name,
                            as: "person_name",
                            attributes: ["given_name", "family_name"],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            model: visit_attribute,
            as: "attributes",
            attributes: ["value_reference"],
            include: [
              {
                model: visit_attribute_type,
                as: "attribute_type",
                attributes: ["name"],
                where: {
                  name: { [Op.in]: ["Visit State", "Visit Speciality"] },
                },
              },
            ],
          },
          {
            model: patient_identifier,
            as: "patient",
            attributes: ["identifier"],
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
          },
          {
            model: location,
            as: "location",
            attributes: [
              "name",
              ["city_village", "village"],
              ["state_province", "state"],
            ],
          },
        ],
        order: [["visit_id", "DESC"]],
      });

      const filteredVisits = visits.filter((visit) => {
        const visitCompleted = visit.encounters.find(
          (enc) => enc?.type?.name === "Visit Complete"
        );

        const visitState = visit?.attributes?.find(
          (attr) => attr?.attribute_type?.name === "Visit State"
        );
        const visitSpeciality = visit?.attributes?.find(
          (attr) => attr?.attribute_type?.name === "Visit Speciality"
        );

        if (state === "All") {
          return (
            visitSpeciality?.value_reference === speciality && !!visitCompleted
          );
        } else {
          return (
            visitState?.value_reference === state &&
            visitSpeciality?.value_reference === speciality &&
            !!visitCompleted
          );
        }
      });
      return filteredVisits;
    } catch (error) {
      throw error;
    }
  };

  return this;
})();
