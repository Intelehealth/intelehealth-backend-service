const CronJob = require("cron").CronJob;
const { Sequelize, active_session, user_status } = require("./models");
const moment = require("moment");

const TIME_FORMAT = "[H]h [M]m";

const removeOldSessions = async () => {
  await active_session.destroy({
    where: {
      endTime: {
        [Sequelize.Op.lte]: new Date(),
      },
    },
  });
};

const mointor = async () => {
  const dayStart = moment().startOf("day");
  const dayEnd = moment().endOf("day");
  let session = await active_session.findAll({
    where: {
      endTime: {
        [Sequelize.Op.between]: [dayStart, dayEnd],
      },
    },
    raw: true,
  });
  let count = 0;
  let sessions = {};
  while (session.length && count <= 100) {
    const rec = session[0];
    if (!Array.isArray(sessions[rec.userUuid])) {
      sessions[rec.userUuid] = session.filter(
        (s) => s.userUuid === rec.userUuid
      );
      session = session.filter((s) => s.userUuid !== rec.userUuid);
    }
    count++;
  }
  for (const uuid in sessions) {
    if (Object.hasOwnProperty.call(sessions, uuid)) {
      let logins = sessions[uuid];
      let devices = {};
      let count = 0;
      while (logins.length && count <= 50) {
        const rec = logins[0];
        if (!Array.isArray(devices[rec.device])) {
          devices[rec.device] = logins.find((s) => s.device === rec.device);
          logins = logins.filter((s) => s.device !== rec.device);
        }
        count++;
      }
      for (const k in devices) {
        if (Object.hasOwnProperty.call(devices, k)) {
          const device = devices[k];
          const totalDuration = device.duration;
          const status = await user_status.findOne({
            where: {
              userUuid: uuid,
              device: device.device,
            },
          });
          const min = Math.abs(totalDuration % 60);
          const hr = Math.abs(Math.floor(totalDuration / 60));
          const avgTimeSpentInADay = `${hr}h ${min}m`;
          const data = {
            userUuid: uuid,
            userType: device.userType,
            avgTimeSpentInADay,
            currentTimestamp: new Date(),
            lastSyncTimestamp: new Date(),
          };
          if (status) {
            const avgTime = moment(status.avgTimeSpentInADay, TIME_FORMAT);
            const newAvgTime = moment(data.avgTimeSpentInADay, TIME_FORMAT);
            if (avgTime.get("hours") > 0 || avgTime.get("minutes") > 0) {
              const total = moment.duration({
                minutes: avgTime.get("minutes"),
                hours: avgTime.get("hours"),
              });
              total.add(newAvgTime.get("minutes"), "minutes");
              total.add(newAvgTime.get("hours"), "hours");
              const totalMinutes = total.asMinutes();
              const avgDuration = Math.floor(totalMinutes / 2);
              const min = Math.abs(avgDuration % 60);
              const hr = Math.abs(Math.floor(avgDuration / 60));
              data.avgTimeSpentInADay = `${hr}h ${min}m`;
            }
            await user_status.update(data, { where: { id: status.id } });
          } else {
            await user_status.create(data);
          }
        }
      }
    }
  }
  removeOldSessions();
};
mointor();
const cronString = `*/1 * * * *`;
// const cronString = "0 0 * * *";
// new CronJob(cronString, mointor, null, true, "Asia/Kolkata");
console.log("Monitoring Cron started......");
