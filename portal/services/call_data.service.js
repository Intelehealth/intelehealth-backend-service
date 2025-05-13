const { logStream } = require("../logger/index");
const { call_data } = require("../models");

module.exports = (function () {

    this.createCallRecordOfWebrtc = async (doctorId, nurseId, roomId, visitId, callStatus) => {
      try {
        const startTime = new Date();
        const data = await call_data.create(
          { doctor_id: doctorId, chw_id: nurseId, room_id: roomId, visit_id: visitId, call_status: callStatus, reason:null, call_duration: 0, start_time: startTime, end_time: null }
        );
    
        return {
            success: true,
            data: data
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

    this.updateCallRecordOfWebrtc = async (usersRecord) => {
        try {
          let endTime = new Date();

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
            if(usersRecord.callStatus || usersRecord.reason){
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
          return {
              success: false,
              data: null,
              error
          };
        }
    };

    return this;
})();




