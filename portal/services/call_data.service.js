const { logStream } = require("../logger");
const { call_data, sequelize } = require("../models");
const { Op } = require("sequelize");

const CALL_STATUSES = {
  SUCCESS: "success",
  UNSUCCESS: "unsuccess",
};

const CALL_TYPES = {
  VIDEO: 'video',
  AUDIO: 'audio'
};

module.exports = (function () {
  /**
   * Creates a new WebRTC call record
   * @param {string} doctorId - The ID of the doctor
   * @param {string} nurseId - The ID of the nurse
   * @param {string} roomId - The room ID for the call
   * @param {string} visitId - The visit ID
   * @param {string} callStatus - The status of the call
   * @param {string} [callType=video] - The type of call (video/audio)
   * @returns {Promise<{success: boolean, data: object}>}
   */
  this.createCallRecordOfWebrtc = async (doctorId, nurseId, roomId, visitId, callStatus, callType = CALL_TYPES.VIDEO) => {
    const t = await sequelize.transaction();
    try {
      if (!doctorId || !nurseId || !roomId || !visitId || !callStatus) {
        throw new Error('Missing required parameters');
      }

      if (callType && !Object.values(CALL_TYPES).includes(callType)) {
          throw new Error('Invalid call type');
      }
      const lastCall = await call_data.findOne({
        where: { visit_id: visitId },
        order: [['start_time', 'DESC']],
        transaction: t
      });
      const currentTime = new Date();
    if (lastCall && lastCall.end_time) {
      const lastCallEndTime = new Date(lastCall.end_time);
      if (currentTime < lastCallEndTime) {
        await t.rollback();
        logStream('warn', `Call blocked: current time ${currentTime.toISOString()} is before last call's end time ${lastCallEndTime.toISOString()}`);
        return { success: false, warning: 'Call cannot start before the previous call has ended' };
      }
    }
      
      const record = await call_data.create({
        doctor_id: doctorId,
        chw_id: nurseId,
        room_id: roomId,
        visit_id: visitId,
        call_status: callStatus,
        call_duration: 0,
        start_time: new Date().toISOString(),
        end_time: null,
        call_type: callType
      }, { transaction: t });

      await t.commit();
      return { success: true, data: record };
    } catch (error) {
      await t.rollback();
      logStream("error", `Error creating call record: ${error.message}`, error);
      return { success: false, data: null, error: error.message };
    }
  };

  /**
   * Updates an existing WebRTC call record
   * @param {Object} usersRecord - The record to update
   * @param {string} usersRecord.doctorId - The ID of the doctor
   * @param {string} usersRecord.roomId - The room ID for the call
   * @param {string} [usersRecord.callStatus] - Optional new call status
   * @param {string} [usersRecord.callType] - Optional call type (video/audio)
   * @returns {Promise<{success: boolean, data: object}>}
   */
  this.updateCallRecordOfWebrtc = async (usersRecord) => {
    const t = await sequelize.transaction();
    try {
      if (!usersRecord.doctorId || !usersRecord.roomId) {
        throw new Error('Missing required parameters: doctorId or roomId');
      }

      const callRecord = await call_data.findOne({
        where: { doctor_id: usersRecord.doctorId, room_id: usersRecord.roomId },
        order: [['createdAt', 'DESC']],
        transaction: t
      });

      if (!callRecord) {
        throw new Error('No call record found for the given doctor and room');
      }

      if (callRecord.end_time) {
        return { success: true, data: callRecord.toJSON(), message: 'Call record already ended' };
      }

            const endTime = new Date().toISOString();
            const updateData = {
                end_time: endTime
            };

            if (callRecord.call_status === CALL_STATUSES.SUCCESS) {
                const durationInSeconds = Math.round(
                    (new Date(endTime) - new Date(callRecord.start_time)) / 1000
                );
                updateData.call_duration = durationInSeconds;
            } else {
                updateData.call_status = CALL_STATUSES.UNSUCCESS;
                updateData.call_duration = 0;
            }

      await call_data.update(updateData, { where: { id: callRecord.id }, transaction: t });
      await t.commit();

      return { success: true, data: { ...callRecord.toJSON(), ...updateData } };
    } catch (error) {
      await t.rollback();
      logStream("error", `Error updating call record: ${error.message}`, error);
      return { success: false, data: null, error: error.message };
    }
  };

  return this;
})();
