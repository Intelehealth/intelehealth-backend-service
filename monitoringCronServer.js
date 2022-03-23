const CronJob = require("cron").CronJob;
const { Sequelize, active_session, user_status } = require("./models");
const moment = require("moment");
const { TIME_FORMAT } = require("./services/user.service");

const removeOldSessions = async () => {
  await active_session.destroy({
    where: {
      endTime: {
        [Sequelize.Op.lte]: new Date(),
      },
    },
  });
};

const monitorCron = () => {
  new Promise(async (res, rej) => {
    const dayStart = moment().startOf("day").toDate();
    const dayEnd = moment().endOf("day").toDate();
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
            devices[rec.device] = logins.filter((s) => s.device === rec.device);
            logins = logins.filter((s) => s.device !== rec.device);
          }
          count++;
        }
        for (const k in devices) {
          if (Object.hasOwnProperty.call(devices, k)) {
            const device = devices[k];
            let totalDuration = 0;
            let _device = "";
            device.forEach((dvc) => {
              totalDuration += !isNaN(Number(dvc.duration))
                ? Number(dvc.duration)
                : 0;
              _device = dvc.device;
            });
            const status = await user_status.findOne({
              where: {
                userUuid: uuid,
                device: _device,
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
            };
            if (status) {
              const avgTime = moment(status.avgTimeSpentInADay, TIME_FORMAT);

              const newAvgTime = moment(data.avgTimeSpentInADay, TIME_FORMAT);
              if (
                newAvgTime.get("hours") > 0 ||
                newAvgTime.get("minutes") > 0
              ) {
                const avg = moment
                  .duration({
                    minutes: avgTime.get("minutes"),
                    hours: avgTime.get("hours"),
                  })
                  .add(newAvgTime.get("minutes"), "minutes")
                  .add(newAvgTime.get("hours"), "hours");
                const avgDuration = Math.floor(avg.asMinutes() / 2);
                data.avgTimeSpentInADay = getHourMins(avgDuration);
              }
              await user_status.update(data, { where: { id: status.id } });
            } else {
              await user_status.create(data);
            }
          }
        }
      }
    }
    await removeOldSessions();
    res(1);
  });
};

const statusCron = () => {
  new Promise(async (res, rej) => {
    const start = moment().startOf("month").toDate();
    const end = moment().subtract(16, "minutes").toDate();
    await user_status.update(
      { status: "inactive" },
      {
        where: {
          [Sequelize.Op.or]: [{ status: "Active" }, { status: "active" }],
          lastSyncTimestamp: {
            [Sequelize.Op.between]: [start, end],
          },
        },
      }
    );
    res(1);
  });
};
// const cronString = `*/1 * * * *`;
const statusCronString = `*/5 * * * *`;
const cronString = "0 0 * * *";
new CronJob(statusCronString, statusCron, null, true, "Asia/Kolkata");
new CronJob(cronString, monitorCron, null, true, "Asia/Kolkata");
console.log("Monitoring Cron started......");
