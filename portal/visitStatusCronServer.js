require("dotenv").config();
const CronJob = require("cron").CronJob;
const moment = require("moment");
const {
  visit,
  encounter,
  encounter_provider,
  Sequelize,
  sequelize,
  obs,
} = require("./openmrs_models");
const Op = Sequelize.Op;
const { getVisits } = require("./services/openmrs.service");

const resetVisit = async (visit) => {
  const _transaction = await sequelize.transaction();

  const enc = await encounter.findAll({
    where: {
      visit_id: visit?.visit_id,
      encounter_type: 9,
    },
  });

  const encProvIds = enc.map((e) => e?.encounter_id);

  const encPro = await encounter_provider.findAll({
    where: {
      encounter_id: { [Op.in]: encProvIds },
    },
  });

  const _obs = await obs.findAll({
    where: {
      encounter_id: { [Op.in]: encProvIds },
    },
  });

  for (let idx = 0; idx < enc.length; idx++) {
    enc[idx].voided = true;
    enc[idx].voided_by = 1;
    enc[idx].date_voided = new Date();
    enc[idx].void_reason = "Automated:Not taken within an hour.";
    await enc[idx].save({ transaction: _transaction });
  }

  for (let idx = 0; idx < encPro.length; idx++) {
    encPro[idx].voided = true;
    encPro[idx].voided_by = 1;
    encPro[idx].date_voided = new Date();
    encPro[idx].void_reason = "Automated:Not taken within an hour.";
    await encPro[idx].save({ transaction: _transaction });
  }

  for (let idx = 0; idx < _obs.length; idx++) {
    _obs[idx].voided = true;
    _obs[idx].voided_by = 1;
    _obs[idx].date_voided = new Date();
    _obs[idx].void_reason = "Automated:Not taken within an hour.";
    await _obs[idx].save({ transaction: _transaction });
  }

  _transaction.commit();
};

const statusCron = () => {
  new Promise(async (res, rej) => {
    const visitIds = await getVisits("Visit In Progress");

    let startTime = moment.utc();
    startTime = startTime.subtract(8, "hour").format("YYYY-MM-DD HH:mm:ss");
    let endTime = moment.utc();
    endTime = endTime.subtract(1, "hour").format("YYYY-MM-DD HH:mm:ss");

    const visits = await visit.findAll({
      where: {
        visit_id: { [Op.in]: visitIds },
        voided: false,
      },
      attributes: ["uuid", "visit_id", "voided"],
      include: [
        {
          required: true,
          model: encounter,
          as: "encounters",
          attributes: [
            "uuid",
            "encounter_datetime",
            "date_created",
            "voided",
            "encounter_type",
          ],
          where: {
            voided: false,
            encounter_type: 9,
            encounter_datetime: {
              //   [Op.between]: [startTime, endTime],
              [Op.lt]: endTime,
            },
          },
        },
      ],
      order: [["visit_id", "DESC"]],
    });

    for (let idx = 0; idx < visits.length; idx++) {
      await resetVisit(visits[idx]);
    }

    console.log("visits: ", visits.length);

    res(1);
  });
};

const statusCronString = `*/1 * * * *`;
new CronJob(statusCronString, statusCron, null, true, "Asia/Kolkata");
