const { logStream } = require("../logger");
const { call_data } = require("../models");

module.exports = (function () {

    this.createCallRecordOfWebrtc = async (doctorId, nurseId, roomId, visitId, callStatus) => {
      try {
        const startTime = new Date();
        await call_data.create(
          { doctor_id: doctorId, chw_id: nurseId, room_id: roomId, visit_id: visitId, call_status: callStatus, call_duration: 0, start_time: startTime, end_time: null }
        );
    
        return {
            success: true,
            data: call_data
        };
      } catch (error) {
        logStream("error", error);
        return {
            success: false,
            data: null,
            error
        };
      }
    };

    this.updateCallRecordOfWebrtc = async (doctorId, nurseId, roomId, callStatus=null) => {
        try {          
          const endTime = new Date();

          const callRecord = await call_data.findOne({
            where: { doctor_id: doctorId, chw_id: nurseId, room_id: roomId, end_time: null }
          });

          if (callRecord) {
            const callDuration = Math.floor((endTime - callRecord.start_time) / 1000); // Duration in seconds

            await call_data.update(
              { call_status: callStatus, call_duration: callDuration, end_time: endTime },
              { where: { id: callRecord.id } }
            );
          }

          return { success: true, data: call_data };
        } catch (error) {
          return {
              success: false,
              data: null,
              error
          };
        }
    };

    return this;
})();




