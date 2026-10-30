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
const { QueryTypes, Op: SequelizeOp } = require("sequelize");
const { locationQuery } = require("../controllers/queries");
const { CALL_DATA_STATUS, CALL_OUTCOMES } = require("../constants/call-outcomes");

// How far back findOpenCallRecord looks; covers a long call ending with bye.
const OPEN_CALL_WINDOW_MS = 3 * 60 * 60 * 1000;
// A doctor cancel this soon after the call was placed is recorded as an immediate cancel.
const IMMEDIATE_CANCEL_MS = 5000;
// A row is still open while ringing (calling) or connected (success) and not yet ended.
const OPEN_STATUSES = [CALL_DATA_STATUS.CALLING, CALL_DATA_STATUS.SUCCESS];

// call_data times are stored shifted to IST, as start_time always has been.
const istTime = (ms = Date.now()) => new Date(ms + (5.5 * 60 * 60 * 1000));

const isOpenRecord = (row) => OPEN_STATUSES.includes(row.call_status) && !row.end_time;

const issueOutcomeOf = (reason) => Object.keys(CALL_OUTCOMES).find((key) =>
  CALL_OUTCOMES[key].phase === "issue" && CALL_OUTCOMES[key].reason === reason
);

const secondsBetween = (from, to) => Math.max(0, Math.floor((to - new Date(from)) / 1000));

module.exports = (function () {

  this.createCallRecordOfWebrtc = async (doctorId, nurseId, roomId, visitId, callStatus, callType) => {
    try {
      const startTime = istTime();

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
      return { success: true, data: data };
    } catch (error) {
      logStream("error", error);
      return { success: false, data: null, error };
    }
  };

  /**
   * Row for an attempt that ended before the HW was called (the "call" event, which creates the
   * row, was never sent), e.g. the token API or the LiveKit connection failed.
   */
  this.createClosedCallRecord = async ({ doctorId, nurseId, roomId, visitId, callType, outcome }) => {
    const def = CALL_OUTCOMES[outcome];
    try {
      const now = istTime();
      const data = await call_data.create({
        doctor_id: doctorId,
        chw_id: nurseId,
        room_id: roomId,
        visit_id: visitId,
        call_status: def.status,
        reason: def.reason,
        call_duration: 0,
        start_time: now,
        end_time: now,
        call_type: ["audio", "video"].includes(callType) ? callType : undefined
      });
      return { success: true, data };
    } catch (error) {
      logStream("error", `createClosedCallRecord failed for doctor ${doctorId}, visit ${visitId}, outcome ${outcome}: ${error?.message}`);
      return { success: false, data: null, error };
    }
  };

  /**
   * Latest still-ringing/ongoing row of a doctor's call. Used when the socket that started the
   * call is gone (page re-created its socket, network reconnect), so its recordId is lost.
   */
  this.findOpenCallRecord = async ({ doctorId, roomId, nurseId }) => {
    if (!doctorId) return null;
    const where = {
      doctor_id: doctorId,
      call_status: { [SequelizeOp.in]: OPEN_STATUSES },
      end_time: null,
      createdAt: { [SequelizeOp.gte]: new Date(Date.now() - OPEN_CALL_WINDOW_MS) },
    };
    if (roomId) where.room_id = roomId;
    else if (nurseId) where.chw_id = nurseId;
    else return null;
    return call_data.findOne({ where, order: [["id", "DESC"]] });
  };

  /**
   * "calling" or "success" while the call is still open, otherwise null.
   */
  this.getOpenCallStatus = async (recordId) => {
    if (!recordId) return null;
    const callRecord = await call_data.findOne({ where: { id: recordId } });
    return callRecord && isOpenRecord(callRecord) ? callRecord.call_status : null;
  };

  /**
   * The column changes an outcome makes to a row, or null when it must not change it: the row
   * is already final, the event repeats, or it arrives out of order (a pre-connection outcome
   * after the call connected).
   */
  this.outcomeChanges = (row, outcome, nowMs = Date.now()) => {
    const def = CALL_OUTCOMES[outcome];
    if (!def || !isOpenRecord(row)) return null;
    const now = istTime(nowMs);

    switch (def.phase) {
      case "connect":
        if (row.call_status === CALL_DATA_STATUS.SUCCESS) return null;
        // start_time becomes the connect time, as it always has been, so the call log's start
        // and end times match the call both apps showed. createdAt keeps the attempt start.
        return { call_status: def.status, reason: def.reason, start_time: now };

      case "end": {
        // start_time is the connect time once connected. A bye without an earlier call-connected
        // still means the call connected, but when is not known, so the duration then counts
        // from the attempt start.
        if (row.call_status !== CALL_DATA_STATUS.SUCCESS) {
          logStream("error", `call_data ${row.id} ended (${outcome}) without a recorded connection; duration counted from the attempt start`);
        }
        return { call_status: def.status, reason: def.reason, end_time: now, call_duration: secondsBetween(row.start_time, now) };
      }

      case "before": {
        if (row.call_status === CALL_DATA_STATUS.SUCCESS) return null;
        let final = outcome;
        if (outcome === "doctorCancelled" && row.createdAt && nowMs - new Date(row.createdAt).getTime() <= IMMEDIATE_CANCEL_MS) {
          final = "doctorCancelledImmediately";
        }
        const issue = issueOutcomeOf(row.reason);
        if (issue && CALL_OUTCOMES[issue].replaces.includes(final)) {
          return { call_status: CALL_DATA_STATUS.FAILURE, reason: CALL_OUTCOMES[issue].reason, end_time: now, call_duration: 0 };
        }
        return { call_status: CALL_OUTCOMES[final].status, reason: CALL_OUTCOMES[final].reason, end_time: now, call_duration: 0 };
      }

      case "issue": {
        if (row.call_status !== CALL_DATA_STATUS.CALLING) return null;
        const current = issueOutcomeOf(row.reason);
        if (current && CALL_OUTCOMES[current].rank >= def.rank) return null;
        return { reason: def.reason };
      }
    }
    return null;
  };

  /**
   * Apply a call outcome (a key of CALL_OUTCOMES) to the attempt's row.
   * @param {object} usersRecord - { outcome, recordId, and with findOpen: doctorId, roomId, nurseId }
   */
  this.updateCallRecordOfWebrtc = async (usersRecord) => {
    const { outcome } = usersRecord;
    if (!CALL_OUTCOMES[outcome]) {
      logStream("error", `updateCallRecordOfWebrtc: unknown call outcome ${outcome}`);
      return { success: false, data: null };
    }
    try {
      let callRecord = usersRecord.recordId
        ? await call_data.findOne({ where: { id: usersRecord.recordId } })
        : null;
      if (!callRecord && usersRecord.findOpen) {
        callRecord = await this.findOpenCallRecord(usersRecord);
      }

      if (!callRecord) {
        logStream("error", `updateCallRecordOfWebrtc: no call_data row for record ${usersRecord.recordId}, doctor ${usersRecord.doctorId}, room ${usersRecord.roomId}; outcome ${outcome} not saved`);
        return { success: false, data: null };
      }

      const changes = this.outcomeChanges(callRecord, outcome);
      if (!changes) {
        return { success: true, data: callRecord, ignored: true };
      }

      // Only if no other event changed the row since it was read.
      const [updated] = await call_data.update(changes, {
        where: { id: callRecord.id, call_status: callRecord.call_status, end_time: null }
      });
      if (!updated) {
        return { success: true, data: callRecord, ignored: true };
      }
      return { success: true, data: callRecord };
    } catch (error) {
      logStream("error", `updateCallRecordOfWebrtc failed for call_data ${usersRecord?.recordId}, outcome ${outcome}: ${error?.message}`);
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
            attributes: ["person_id"],
            required: false,
            include: [
              {
                model: person_address,
                as: "person_address",
                attributes: ["county_district", "address3", "city_village"],
                required: false,
                where: { voided: 0, preferred: 1 },
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
        district: 'Nashik',
        state: 'Maharashtra',
      };

      if (isTurnServer) {
        row.block = item2?.person?.person_address?.address3 || null;
        row.village = item2?.person?.person_address?.city_village || null;
        row.city = item2?.person?.person_address?.county_district || null;
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
