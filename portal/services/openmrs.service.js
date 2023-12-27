const { QueryTypes } = require("sequelize");
const { getVisitCountV2 } = require("../controllers/queries");
const {
  visit,
  encounter,
  patient_identifier,
  person_name,
  encounter_type,
  encounter_provider,
  person,
  provider,
  location,
  visit_attribute,
  obs,
  Sequelize,
  sequelize,
} = require("../openmrs_models");
const Op = Sequelize.Op;

module.exports = (function () {
  this.getVisits = async (type) => {
    if (!type) {
      return [];
    } else {
      const visits = await sequelize.query(getVisitCountV2(), {
        type: QueryTypes.SELECT,
      });

      return Array.isArray(visits)
        ? visits.filter((v) => v?.Status === type).map((v) => v?.visit_id)
        : [];
    }
  };
  /**
   * Encounter type
   * 1 - ADULTINITIAL
   * 6 - Vitals
   * 9 - Visit Note
   * 12 - Patient Exit Survey
   * 14 - Visit Complete
   * 15 - Flagged
   */
  this.getVisitsByType = async (
    state,
    speciality,
    page = 1,
    limit = 100,
    type
  ) => {
    try {
      let offset = limit * (Number(page) - 1);

      if (limit > 5000) limit = 5000;
      const visitIds = await this.getVisits(type);

      const value_reference = [speciality];
      if (state !== "All") {
        value_reference.push(state);
      }

      const visits = await visit.findAll({
        where: {
          visit_id: { [Op.in]: visitIds },
        },
        attributes: ["uuid"],
        include: [
          {
            model: encounter,
            as: "encounters",
            attributes: ["encounter_datetime"],
            include: [
              // {
              //   model: obs,
              //   as: "obs",
              //   attributes: ["value_text", "concept_id"],
              // },
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
              attribute_type_id: { [Op.in]: [5, 6, 8] },
              // value_reference: { [Op.in]: value_reference },
            },
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
      return await getVisitsByType(state, speciality, page, limit, "Priority");
    } catch (error) {
      throw error;
    }
  };

  this._getAwaitingVisits = async (
    state,
    speciality,
    page = 1,
    limit = 1000
  ) => {
    try {
      return await getVisitsByType(
        state,
        speciality,
        page,
        limit,
        "Awaiting Consult"
      );
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
      return await getVisitsByType(
        state,
        speciality,
        page,
        limit,
        "Visit In Progress"
      );
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
    try {
      return await getVisitsByType(
        state,
        speciality,
        page,
        limit,
        "Completed Visit"
      );
    } catch (error) {
      throw error;
    }
  };

  return this;
})();
