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
  this._getAwaitingVisits = async (
    state,
    speciality,
    page = 1,
    limit = 1000
  ) => {
    try {
      let offset = limit * (Number(page) - 1);

      if (limit > 5000) limit = 5000;

      const otherVisitIds = await visit.findAll({
        required: true,
        attributes: ["visit_id"],
        include: [
          {
            required: true,
            where: {
              encounter_type: { [Op.in]: [9, 12, 14, 15] },
            },
            model: encounter,
            as: "encounters",
            attributes: ["encounter_type"],
          },
        ],
      });

      const othrIds = otherVisitIds.map((visit) => visit?.visit_id);

      const value_reference = [speciality];
      if (state !== "All") {
        value_reference.push(state);
      }

      const visits = await visit.findAll({
        where: {
          visit_id: { [Op.in]: othrIds },
          voided: false,
          date_stopped: null,
        },
        attributes: ["uuid"],
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
                where: {
                  value_text: { [Op.ne]: null },
                  concept_id: 163212,
                },
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
            attributes: ["value_reference", "attribute_type_id"],
            where: {
              attribute_type_id: { [Op.in]: [5, 6] },
              value_reference: { [Op.in]: value_reference },
            },
            // include: [
            //   {
            //     model: visit_attribute_type,
            //     as: "attribute_type",
            //     attributes: ["name"],
            //     where: {
            //       name: { [Op.in]: ["Visit State", "Visit Speciality"] },
            //     },
            //   },
            // ],
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
            attributes: ["name"],
          },
        ],
        order: [["visit_id", "DESC"]],
        limit,
        offset,
      });

      return visits;
    } catch (error) {
      throw error;
    }
  };

  this._getPriorityVisits = async (
    state,
    speciality,
    page = 1,
    limit = 1000
  ) => {
    try {
      let offset = limit * (Number(page) - 1);

      if (limit > 5000) limit = 5000;

      const otherVisitIds = await visit.findAll({
        attributes: ["visit_id"],
        where: {
          voided: false,
          date_stopped: null,
        },
        include: [
          {
            required: true,
            where: {
              encounter_type: { [Op.in]: [15] },
              voided: false,
            },
            model: encounter,
            as: "encounters",
            attributes: ["encounter_type"],
          },
        ],
      });

      const othrIds = otherVisitIds.map((visit) => visit?.visit_id);

      const value_reference = [speciality];
      if (state !== "All") {
        value_reference.push(state);
      }

      const visits = await visit.findAll({
        where: {
          visit_id: { [Op.in]: othrIds },
          voided: false,
          date_stopped: null,
        },
        attributes: ["uuid"],
        include: [
          {
            required: true,
            where: {
              encounter_type: { [Op.in]: [15, 1] },
            },
            model: encounter,
            as: "encounters",
            attributes: ["encounter_datetime", "encounter_id"],
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
            attributes: ["value_reference", "attribute_type_id"],
            where: {
              attribute_type_id: { [Op.in]: [5, 6] },
              value_reference: { [Op.in]: value_reference },
            },
            // include: [
            //   {
            //     model: visit_attribute_type,
            //     as: "attribute_type",
            //     attributes: ["name"],
            //     where: {
            //       name: { [Op.in]: ["Visit State", "Visit Speciality"] },
            //     },
            //   },
            // ],
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
            attributes: ["name"],
          },
        ],
        order: [["visit_id", "DESC"]],
        limit,
        offset,
      });

      // const filteredVisits = visits.filter((visit) => {
      //   const priority = visit.encounters.find(
      //     (enc) => enc?.type?.name === "Flagged"
      //   );
      //   const visitState = visit?.attributes?.find(
      //     (attr) => attr?.attribute_type?.name === "Visit State"
      //   );
      //   const visitSpeciality = visit?.attributes?.find(
      //     (attr) => attr?.attribute_type?.name === "Visit Speciality"
      //   );

      //   if (state === "All") {
      //     return visitSpeciality?.value_reference === speciality && !!priority;
      //   } else {
      //     return (
      //       visitState?.value_reference === state &&
      //       visitSpeciality?.value_reference === speciality &&
      //       !!priority
      //     );
      //   }
      // });
      return visits;
    } catch (error) {
      throw error;
    }
  };

  this._getInProgressVisits = async (
    state,
    speciality,
    page = 1,
    limit = 100
  ) => {
    try {
      let offset = limit * (Number(page) - 1);

      if (limit > 5000) limit = 5000;

      const value_reference = [speciality];
      if (state !== "All") {
        value_reference.push(state);
      }

      const visits = await visit.findAll({
        where: { voided: false },
        attributes: ["uuid"],
        include: [
          {
            where: {
              encounter_type: { [Op.in]: [1, 9] },
            },
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
            attributes: ["value_reference", "attribute_type_id"],
            where: {
              attribute_type_id: { [Op.in]: [5, 6] },
              value_reference: { [Op.in]: value_reference },
            },
            // include: [
            //   {
            //     model: visit_attribute_type,
            //     as: "attribute_type",
            //     attributes: ["name"],
            //     where: {
            //       name: { [Op.in]: ["Visit State", "Visit Speciality"] },
            //     },
            //   },
            // ],
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
            attributes: ["name"],
          },
        ],
        order: [["visit_id", "DESC"]],
        limit,
        offset,
      });

      // const filteredVisits = visits.filter((visit) => {
      //   const visitNote = visit.encounters.find(
      //     (enc) => enc?.type?.name === "Visit Note"
      //   );

      //   const visitState = visit?.attributes?.find(
      //     (attr) => attr?.attribute_type?.name === "Visit State"
      //   );
      //   const visitSpeciality = visit?.attributes?.find(
      //     (attr) => attr?.attribute_type?.name === "Visit Speciality"
      //   );

      //   if (state === "All") {
      //     return visitSpeciality?.value_reference === speciality && !!visitNote;
      //   } else {
      //     return (
      //       visitState?.value_reference === state &&
      //       visitSpeciality?.value_reference === speciality &&
      //       !!visitNote
      //     );
      //   }
      // });
      return visits;
    } catch (error) {
      throw error;
    }
  };

  this._getCompletedVisits = async (
    state,
    speciality,
    page = 1,
    limit = 100
  ) => {
    let offset = limit * (Number(page) - 1);

    if (limit > 5000) limit = 5000;

    try {
      const value_reference = [speciality];
      if (state !== "All") {
        value_reference.push(state);
      }

      const visits = await visit.findAll({
        // where: { voided: false },
        attributes: ["uuid"],
        include: [
          {
            required: true,
            where: {
              encounter_type: { [Op.in]: [1, 14] },
              // encounter_type: { [Op.in]: [1, 9] },
            },
            model: encounter,
            as: "encounters",
            attributes: ["encounter_datetime"],
            include: [
              {
                model: obs,
                as: "obs",
                attributes: ["value_text", "concept_id"],
                where: {
                  value_text: { [Op.ne]: null },
                  concept_id: 163212,
                },
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
            attributes: ["value_reference", "attribute_type_id"],
            where: {
              attribute_type_id: { [Op.in]: [5, 6] },
              value_reference: { [Op.in]: value_reference },
            },
            // include: [
            //   {
            //     model: visit_attribute_type,
            //     as: "attribute_type",
            //     attributes: ["name"],
            //     where: {
            //       name: { [Op.in]: ["Visit State", "Visit Speciality"] },
            //     },
            //   },
            // ],
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
            attributes: ["name"],
          },
        ],
        order: [["visit_id", "DESC"]],
        limit,
        offset,
      });

      // const filteredVisits = visits.filter((visit) => {
      //   const visitCompleted = visit.encounters.find(
      //     (enc) => enc?.type?.name === "Visit Complete"
      //   );

      //   const visitState = visit?.attributes?.find(
      //     (attr) => attr?.attribute_type?.name === "Visit State"
      //   );
      //   const visitSpeciality = visit?.attributes?.find(
      //     (attr) => attr?.attribute_type?.name === "Visit Speciality"
      //   );

      //   if (state === "All") {
      //     return (
      //       visitSpeciality?.value_reference === speciality && !!visitCompleted
      //     );
      //   } else {
      //     return (
      //       visitState?.value_reference === state &&
      //       visitSpeciality?.value_reference === speciality &&
      //       !!visitCompleted
      //     );
      //   }
      // });
      return visits;
    } catch (error) {
      throw error;
    }
  };

  return this;
})();
