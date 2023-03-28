const {
  visit,
  encounter,
  patient_identifier,
  person_name,
  encounter_type,
  Sequelize,
} = require("../openmrs_models");

module.exports = (function () {
  this._getAwaitingVisits = async (data) => {
    try {
      return await visit.findOne({
        include: [
          {
            required: true,
            model: encounter,
            as: "encounters",
            include: [
              {
                model: encounter_type,
                as: "type",
                attributes: ["name"],
              },
            ],
            where: {
              name: {
                [Sequelize.Op.ne]: "Visit Complete",
              },
            },
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
