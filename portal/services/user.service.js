const { user_status, active_session, call_data } = require("../models");
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
  Sequelize,
  sequelize
} = require("../openmrs_models");
const Op = Sequelize.Op;
const { QueryTypes } = require("sequelize");

const moment = require("moment");

module.exports = (function () {
  this.TIME_FORMAT = "[H]h [M]m";
  const HEARTBEAT_DURATION = 20;

  const createSession = async (data, duration) => {
    if (duration && duration <= HEARTBEAT_DURATION) {
      active_session.create({
        startTime: moment().subtract(duration, "m").toDate(),
        endTime: new Date(),
        device: data.device,
        userUuid: data.userUuid,
        userType: data.userType ? data.userType : "Health Worker",
        duration,
      });
    }
  };

  this._createUpdateStatus = async (data) => {
    try {
      const { userUuid = "", device = "", forceUpdate = false } = data;
      let status = await user_status.findOne({
        where: {
          userUuid,
        },
        order: [["updatedAt", "ASC"]],
        raw: true,
      });

      const updatedAt = (status && status.updatedAt) || new Date();
      const duration = Math.abs(moment().diff(moment(updatedAt), "m"));

      data.lastSyncTimestamp = new Date();
      if (status) {
        if (duration > 0 && duration <= HEARTBEAT_DURATION) {
          if (!status.totalTime) status.totalTime = "0h 0m";
          const totalTime = moment(status.totalTime, this.TIME_FORMAT);
          const total = moment
            .duration({
              minutes: totalTime.get("minutes"),
              hours: totalTime.get("hours"),
            })
            .add(duration, "minutes");
          data.totalTime = this.getHourMins(total.asMinutes());
        }
        await createSession(data, duration);
        return await user_status.update(data, { where: { id: status.id } });
      } else if (!forceUpdate) {
        await createSession(data, duration);
        return await user_status.create(data);
      }
    } catch (error) {
      throw error;
    }
  };

  this._getStatuses = async (userUuid, query = {}) => {
    try {
      let where = {};
      if (userUuid) {
        where = {
          userUuid,
        };
      }
      return await user_status.findAll({
        where,
        // offset: query.start ? parseInt(query.start) : 0,
        // limit: query.limit ? parseInt(query.limit) : 10,
        raw: true,
      });
    } catch (error) {
      throw error;
    }
  };

  this._getWebrtcStatuses = async () => {
    try {
      let callData = await call_data.findAll({
        // offset: query.start ? parseInt(query.start) : 0,
        // limit: query.limit ? parseInt(query.limit) : 10,
        raw: true,
      });
      const visitIds = Array.isArray(callData)
        ? callData.map(v => v?.visit_id)
        : [];
      const visits = await visit.findAll({
        where: {
          uuid: { [Op.in]: visitIds },
        },
        attributes: ["uuid", "date_stopped", "date_created"],
        include: [
          {
            model: encounter,
            as: "encounters",
            attributes: ["encounter_datetime"],
            include: [
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
                            attributes: ["given_name", "family_name", "middle_name"],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
            where: {
              voided: 0,
            }
          },
          {
            model: patient_identifier,
            as: "patient",
            attributes: ["identifier"],
          },
          {
            model: person_name,
            as: "patient_name",
            attributes: ["given_name", "family_name", "middle_name"],
          },
          {
            model: location,
            as: "location",
            attributes: ["name", ["parent_location", "parent"]],
          },
        ],
        order: [["visit_id", "DESC"]]
      });
      const query = "SELECT u.uuid AS userUuid, p.uuid AS personUuid,CONCAT(pn.given_name, ' ', pn.family_name) AS doctorName FROM users u LEFT JOIN person p ON p.person_id = u.person_id LEFT JOIN person_name pn ON pn.person_id = u.person_id WHERE u.uuid IN ('" + callData.map(d => d.doctor_id).join("','") + "') AND pn.preferred = 1 AND u.retired = 0";
      const queryResult = await sequelize.query(query, {
        type: QueryTypes.SELECT,
      });
      const visitsByCallData = await this.setVisitsByCallData(callData, visits);
      const merged = visitsByCallData.map(item1 => {
        const item2 = queryResult.find(item => item.userUuid === item1.doctor_id);
        return {
          ...item1,
          doctorName: item2?.doctorName
        };
      });
      return { callData: merged, totalCount: merged.length };
    } catch (error) {
      throw error;
    }
  };

  this.setVisitsByCallData = async (callData, visits) => {
    const merged = callData.map(item1 => {
      const item2 = visits.find(item => item.uuid === item1.visit_id);
      return {
        doctor_id: item1.doctor_id,
        sevika_id: item1.chw_id,
        call_status: item1.call_status,
        call_duration: item1.call_duration,
        start_time: item1.start_time,
        end_time: item1.end_time,
        reason: item1.reason,
        patientId: item2?.patient?.identifier,
        patientName: `${item2?.patient_name?.given_name} ${item2?.patient_name?.family_name}`,
        location: item2?.location?.name,
        sevikaName: `${item2.encounters.find(e => e.type.name === 'Vitals')?.encounter_provider?.provider?.person?.person_name?.given_name} ${item2.encounters.find(e => e.type.name === 'Vitals')?.encounter_provider?.provider?.person?.person_name?.family_name}`
      };
    });
    return merged;
  };

  this.getHourMins = (val = 0) => {
    let hr = Math.abs(Math.floor(val / 60));
    let min = Math.abs(val % 60);
    hr = !isNaN(hr) ? hr : 0;
    min = !isNaN(min) ? min : 0;
    return `${hr}h ${min}m`;
  };
  return this;
})();
