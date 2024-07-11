const { QueryTypes } = require("sequelize");
const { axiosInstance } = require("../handlers/helper");
const { getVisitCountV2, locationQuery } = require("../controllers/queries");
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
  this.setLocationTree = (data) => {
    let states = data.filter((d) => d.tag === "State");
    if (states.length) {
      states = states.map((s) => {
        let districts = data.filter(
          (d) => d.parent === s.id && d.tag === "District"
        );
        if (districts.length) {
          districts = districts.map((d) => {
            let child = {};
            const sanchs = data.filter(
              (s) => s.parent === d.id && s.tag === "Sanch"
            );
            const tehsils = data.filter(
              (t) => t.parent === d.id && t.tag === "Tehsil"
            );
            if (sanchs.length) {
              child.sanchs = sanchs.map((s) => {
                const villages = data
                  .filter((v) => v.parent === s.id && v.tag === "Village")
                  .map(({ name, uuid, id }) => ({ name, uuid, id }));

                return { name: s.name, uuid: s.uuid, id: s.id, villages };
              });
            } else if (tehsils.length) {
              child.tehsils = tehsils.map((t) => {
                const villages = data
                  .filter((v) => v.parent === t.id && v.tag === "Village")
                  .map(({ name, uuid, id }) => ({ name, uuid, id }));

                return { name: s.name, uuid: s.uuid, id: s.id, villages };
              });
            } else {
              child.villages = data
                .filter((v) => v.parent === d.id && v.tag === "Village")
                .map(({ name, uuid, id }) => ({ name, uuid, id }));
            }
            return {
              name: d.name,
              uuid: d.uuid,
              id: d.id,
              ...child,
            };
          });
        }

        return {
          name: s.name,
          id: s.id,
          uuid: s.uuid,
          districts,
        };
      });
    }

    return states;
  };

  this.setSanchForVisits = async (data) => {
    const visits = [];
    locations = await sequelize.query(locationQuery(), {
      type: QueryTypes.SELECT,
    });
    for (let idx = 0; idx < data.length; idx++) {
      let vst = data[idx].toJSON();
      if (vst?.location?.parent) {
        vst.sanch = locations.find(
          (l) => l?.id === vst?.location?.parent && l?.tag === "Sanch"
        )?.name;
      }
      visits.push(vst);
    }

    return visits;
  };

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
            where: {
              voided: { [Op.eq]: 0 },
            },
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
            attributes: ["name", ["parent_location", "parent"]],
          },
        ],
        order: [["visit_id", "DESC"]],
        limit,
        offset,
      });

      return await this.setSanchForVisits(visits);
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

  this._updateLocationAttributes   = async (locationId, dataToUpdate) => {
      let response = await axiosInstance.get(
        `/openmrs/ws/rest/v1/location/${locationId}/attribute`
      );
      for (let key of dataToUpdate) {
          let attr = response.data.results.find((a) => a.attributeType.uuid === key.attributeType);
          if (attr) {
              //update
              const payload = {
                attributeType: attr.attributeType.uuid,
                value:key.value,
              };
              const url = `/openmrs/ws/rest/v1/location/${locationId}/attribute/${attr.uuid}`;
              await axiosInstance.post(url, payload).catch((err) => {});
            } else {
              //create
              const payload = {
                attributeType: key.attributeType,
                value:key.value,
              };
              const url = `/openmrs/ws/rest/v1/location/${locationId}/attribute`;
              await axiosInstance.post(url, payload).catch((err) => {});
            }
      }
      let updatedRes = await axiosInstance.get(
        `/openmrs/ws/rest/v1/location/${locationId}/attribute`
      );
      return (updatedRes.data.results);
  };

  return this;
})();
