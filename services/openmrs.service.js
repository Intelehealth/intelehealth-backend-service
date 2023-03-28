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
  visit_attribute,
  visit_attribute_type,
  obs,
  Sequelize,
} = require("../openmrs_models");
const Op = Sequelize.Op;

module.exports = (function () {
  this._getAwaitingVisits = async (data) => {
    try {
      const otherVisitIds = await visit.findAll({
        required: true,
        attributes: ["visit_id", "uuid"],
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

      return await visit.findAll({
        required: true,
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
            model: visit_attribute,
            as: "attributes",
            attributes: ["value_reference"],
            include: [
              {
                model: visit_attribute_type,
                as: "attribute_type",
                attributes: ["name"],
              },
            ],
          },
          {
            model: patient_identifier,
            as: "patient",
            attributes: ["identifier", "uuid"],
          },
          {
            model: person_name,
            as: "patient_name",
            attributes: ["given_name", "family_name"],
          },
        ],
      });
    } catch (error) {
      throw error;
    }
  };

  return this;
})();
