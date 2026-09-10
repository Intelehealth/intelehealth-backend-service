const { logStream } = require("../logger/index");
const { call_data } = require("../models");
const {
  visit,
  encounter,
  patient_identifier,
  person_name,
  encounter_type,
  encounter_provider,
  person,
  person_address,
  provider,
  location,
  Sequelize,
  sequelize
} = require("../openmrs_models");
const Op = Sequelize.Op;
const { QueryTypes } = require("sequelize");

module.exports = (function () {

  this.createCallRecordOfWebrtc = async (doctorId, nurseId, roomId, visitId, callStatus, callType) => {
    try {
      const startTime = new Date(new Date().getTime() + (5.5 * 60 * 60 * 1000));
      console.log('startTime:', startTime);

      const data = await call_data.create({
        doctor_id: doctorId,
        chw_id: nurseId,
        room_id: roomId,
        visit_id: visitId,
        call_status: callStatus,
        reason: null,
        call_duration: 0,
        start_time: startTime,
        end_time: null,
        call_type: callType
      }
      );
      console.log('Call Record Created:', data);
      return { success: true, data: data };
    } catch (error) {
      logStream("error", error);
      return { success: false, data: null, error };
    }
  };

  this.updateCallRecordOfWebrtc = async (usersRecord) => {
    try {
      let endTime = new Date(new Date().getTime() + (5.5 * 60 * 60 * 1000));
      console.log('endTime:', endTime);

      const callRecord = await call_data.findOne({
        where: { id: usersRecord.recordId }
      });

      if (callRecord) {
        let callDuration = Math.floor((endTime - callRecord.start_time) / 1000); // Duration in seconds
        if(usersRecord.callStatus === 'failure') {
          endTime = null;
          callDuration = 0;
        } else {
          usersRecord.reason = null;
        }
        
        if(usersRecord?.startTime) {
          await call_data.update(
            { start_time: usersRecord?.startTime },
            { where: { id: callRecord.id } }
          );
        } else if(usersRecord.callStatus || usersRecord.reason){
          await call_data.update(
            { call_status: usersRecord.callStatus, reason: usersRecord.reason, call_duration: callDuration, end_time: endTime },
            { where: { id: callRecord.id } }
          );
        }else{
          await call_data.update(
            { call_duration: callDuration, end_time: endTime },
            { where: { id: callRecord.id } }
          );
        }
      }

      return { success: true, data: call_data };
    } catch (error) {
      return { success: false, data: null, error };
    }
  };

  // WebRTC call log for doctor<->health-worker calls (call_data, webapp only).
  this._getWebrtcStatuses = async () => {
    try {
      const isTurnServer = process.env.IS_TURN_SERVER === 'true';
      let callData = await call_data.findAll({
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
          // Sevika/CHW name only applies to the webapp (doctor<->health-worker) flow, not turn's direct patient calls.
          ...(isTurnServer ? [] : [{
            model: encounter,
            as: "encounters",
            attributes: ["encounter_datetime"],
            required: false,
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
          }]),
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
          // State/Block/Village are only shown for turn (direct-to-patient) calls.
          ...(isTurnServer ? [{
            model: person,
            as: "person",
            attributes: [],
            required: false,
            include: [
              {
                model: person_address,
                as: "person_address",
                attributes: ["state_province", "address3", "city_village"],
                required: false,
                where: { voided: 0 },
              },
            ],
          }] : []),
          {
            model: location,
            as: "location",
            attributes: ["name", ["parent_location", "parent"]],
          },
        ],
        order: [["visit_id", "DESC"]]
      });
      const doctorIds = [...new Set(callData.map(d => d.doctor_id).filter(Boolean))];
      const queryResult = doctorIds.length
        ? await sequelize.query(
            `SELECT u.uuid AS userUuid, p.uuid AS personUuid, CONCAT(pn.given_name, ' ', pn.family_name) AS doctorName
             FROM users u
             LEFT JOIN person p ON p.person_id = u.person_id
             LEFT JOIN person_name pn ON pn.person_id = u.person_id
             WHERE u.uuid IN (:doctorIds) AND pn.preferred = 1 AND u.retired = 0`,
            { replacements: { doctorIds }, type: QueryTypes.SELECT }
          )
        : [];
      const visitsByCallData = this.setVisitsByCallData(callData, visits);
      const merged = visitsByCallData.map(item1 => {
        const item2 = queryResult.find(item => item.userUuid === item1.doctor_id);
        return {
          ...item1,
          doctorName: item2?.doctorName || null,
        };
      });
      return { callData: merged, totalCount: merged.length };
    } catch (error) {
      throw error;
    }
  };

  this.setVisitsByCallData = (callData, visits) => {
    const isTurnServer = process.env.IS_TURN_SERVER === 'true';

    return callData.map(item1 => {
      const item2 = visits.find(item => item.uuid === item1.visit_id);

      const row = {
        doctor_id: item1.doctor_id,
        sevika_id: item1.chw_id,
        room_id: item1.room_id,
        call_status: item1.call_status,
        call_duration: item1.call_duration,
        start_time: item1.start_time,
        end_time: item1.end_time,
        reason: item1.reason,
        patientId: item2?.patient?.identifier || item1.room_id,
        patientName: item2?.patient_name
          ? `${item2.patient_name.given_name || ''} ${item2.patient_name.family_name || ''}`.trim()
          : null,
        location: item2?.location?.name || null,
      };

      if (isTurnServer) {
        row.block = item2?.person?.person_address?.address3 || null;
        row.village = item2?.person?.person_address?.city_village || null;
        row.state = item2?.person?.person_address?.state_province || null;
      } else {
        const vitalsEncounter = item2?.encounters?.find(e => e.type?.name === 'Vitals');
        const sevikaGiven = vitalsEncounter?.encounter_provider?.provider?.person?.person_name?.given_name;
        const sevikaFamily = vitalsEncounter?.encounter_provider?.provider?.person?.person_name?.family_name;
        row.sevikaName = sevikaGiven || sevikaFamily ? `${sevikaGiven || ''} ${sevikaFamily || ''}`.trim() : null;
      }

      return row;
    });
  };

  return this;
})();
