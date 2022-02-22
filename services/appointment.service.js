const {
  appointment_schedule: Schedule,
  appointments: Appointment,
  appointment_settings: Setting,
  Sequelize,
} = require("../models");
const Op = Sequelize.Op;

const moment = require("moment");
const {
  asyncForEach,
  getDataFromQuery,
  sendCloudNotification,
} = require("../handlers/helper");

module.exports = (function () {
  const DATE_FORMAT = "DD/MM/YYYY";
  const TIME_FORMAT = "LT";
  const FILTER_TIME_DATE_FORMAT = "DD/MM/YYYY HH:mm:ss";

  const sendCancelNotification = async ({ id, slotTime, patientName }) => {
    const query = `
    select
    a.id,
    u.device_reg_token as token,
    u.locale as locale
from
    appointments a
    INNER JOIN user_settings u ON u.user_uuid = a.hwUUID
where
    a.id = ${id};`;
    try {
      const data = await getDataFromQuery(query);
      if (data && data.length) {
        asyncForEach(data, async (item) => {
          const { token, locale } = item;
          console.log("locale: ", locale);
          if (token) {
            await sendCloudNotification({
              title:
                locale === "ru"
                  ? `Запись на прием за ${patientName}(${slotTime}) отменена.`
                  : `Appointment for ${patientName}(${slotTime}) has been cancelled.`,
              body:
                locale === "ru"
                  ? `Причина: В связи с изменением графика врача`
                  : `Reason : Due to doctor's change in schedule.`,
              regTokens: [token],
            }).catch((err) => { });
          }
        });
      }
    } catch (error) { }
  };

  const sendCancelNotificationToWebappDoctor = async ({
    id,
    slotTime,
    patientName,
    openMrsId,
  }) => {
    const query = `SELECT
    a.id,
    s.notification_object as webpush_obj,
    s.locale  as locale
FROM
    appointments a
    INNER JOIN pushnotification s ON a.userUuid = s.user_uuid
WHERE
    a.id = ${id}`;
    try {
      const data = await getDataFromQuery(query);
      if (data && data.length) {
        asyncForEach(data, async (data) => {
          if (data.webpush_obj) {
            const engTitle = `Appointment for ${patientName}(${slotTime}) has been cancelled.`;
            const ruTitle = `Запись на прием за ${patientName}(${slotTime}) отменена.`;
            const title = data.locale === "ru" ? ruTitle : engTitle;
            sendWebPushNotificaion({
              webpush_obj: data.webpush_obj,
              title,
              body: openMrsId,
            });
          }
        });
      }
    } catch (error) { }
  };

  const getTodayDate = () => {
    return this.getFilterDates(moment().format("DD/MM/YYYY"), null)[0];
  };

  /**
   * Create & updates a schedule if already exist for userUuid
   * @param {string} userUuid
   * @param {string} slotDays
   * @param {object} slotSchedule
   */
  this.upsertAppointmentSchedule = async ({
    userUuid,
    slotDays,
    slotSchedule,
    speciality,
    drName,
    type,
    month,
    year,
  }) => {
    try {
      const opts = { where: { userUuid, year, month } };
      const schedule = await this.getUserAppointmentSchedule(opts);
      let update = { slotDays };
      if (slotSchedule) update.slotSchedule = slotSchedule;
      if (drName) update.drName = drName;
      if (speciality) update.speciality = speciality;
      if (type) update.type = type;
      if (year) update.year = year;
      if (month) update.month = month;
      if (schedule) {
        const resp = {
          message: "Appointment updated successfully",
          data: await Schedule.update(update, opts),
        };
        await this.rescheduleOrCancelAppointment(userUuid);

        return resp;
      } else {
        return {
          message: "Appointment created successfully",
          data: await Schedule.create({
            userUuid,
            slotDays,
            slotSchedule,
            speciality,
            drName,
            type,
            month,
            year,
          }),
        };
      }
    } catch (error) {
      throw error;
    }
  };

  /**
   * Return appointments
   * @param {object} findOptions
   * @returns []Array
   */
  this.getUserAppointmentSchedule = async (opts = {}, method = "findAll") => {
    try {
      return await Schedule[method](opts);
    } catch (error) {
      throw error;
    }
  };

  this.getFilterDates = (fromDate, toDate) => {
    return [
      moment.utc(`${fromDate} 00:00:00`, FILTER_TIME_DATE_FORMAT).format(),
      moment.utc(`${toDate} 23:59:59`, FILTER_TIME_DATE_FORMAT).format(),
    ];
  };

  this.getUserSlots = async ({ userUuid, fromDate, toDate }) => {
    try {
      const data = await Appointment.findAll({
        where: {
          userUuid,
          slotJsDate: {
            [Op.between]: this.getFilterDates(fromDate, toDate),
          },
          status: "booked",
        },
        raw: true,
      });
      return data;
    } catch (error) {
      throw error;
    }
  };

  this.getSlots = async ({ locationUuid, fromDate, toDate }) => {
    try {
      const data = await Appointment.findAll({
        where: {
          locationUuid,
          slotJsDate: {
            [Op.between]: this.getFilterDates(fromDate, toDate),
          },
          status: "booked",
        },
        raw: true,
      });
      return data;
    } catch (error) {
      throw error;
    }
  };

  const getMonthSlots = ({
    schedule,
    days,
    SLOT_DURATION,
    SLOT_DURATION_UNIT,
  }) => {
    let dates = [];
    const slots = schedule.slotSchedule.filter((s) => s.startTime && s.endTime);
    const slotDays = slots
      .map((s) => moment(s.date).get("date"))
      .sort((a, b) => a - b);

    schedule.daysToSchedule = days.filter((d) => {
      const date = moment(d.normDate, DATE_FORMAT).get("date");
      return slotDays.includes(date);
    });

    // const daysToSchedule = schedule.daysToSchedule.filter((d) => {
    //   return days.map((d) => d.normDate);
    // });
    schedule.daysToSchedule.forEach((slot) => {
      const slotSchedule = slots.find(
        (s) => moment(s.date).format(DATE_FORMAT) === slot.normDate
      );
      if (slotSchedule) {
        const { startTime, endTime } = slotSchedule;
        let now = moment(startTime, TIME_FORMAT);
        let deadline = moment(endTime, TIME_FORMAT);
        while (now.diff(deadline) < 0) {
          if (now > moment(now).hour(8)) {
            dates.push({
              slotDay: slot.day,
              slotDate: slot.normDate,
              slotDuration: SLOT_DURATION,
              slotDurationUnit: SLOT_DURATION_UNIT,
              slotTime: now.format(TIME_FORMAT),
              speciality: schedule.speciality,
              userUuid: schedule.userUuid,
              drName: schedule.drName,
            });
          }
          now.add(SLOT_DURATION, SLOT_DURATION_UNIT);
        }
      }
    });

    return dates;
  };

  const getWeekSlots = ({
    schedule,
    days,
    SLOT_DURATION,
    SLOT_DURATION_UNIT,
  }) => {
    let dates = [];
    const slots = schedule.slotSchedule.filter((s) => s.startTime && s.endTime);
    const slotDays = slots.map((s) => s.day);
    schedule.daysToSchedule = days.filter((d) => slotDays.includes(d.day));

    // const daysToSchedule = schedule.daysToSchedule.filter((d) => {
    //   return days.map((d) => d.normDate);
    // });
    schedule.daysToSchedule.forEach((slot) => {
      const slotSchedule = slots.find((s) => s.day === slot.day);
      if (slotSchedule) {
        const { startTime, endTime } = slotSchedule;
        let now = moment(startTime, TIME_FORMAT);
        let deadline = moment(endTime, TIME_FORMAT);
        while (now.diff(deadline) < 0) {
          if (now > moment(now).hour(8)) {
            dates.push({
              slotDay: slot.day,
              slotDate: slot.normDate,
              slotDuration: SLOT_DURATION,
              slotDurationUnit: SLOT_DURATION_UNIT,
              slotTime: now.format(TIME_FORMAT),
              speciality: schedule.speciality,
              userUuid: schedule.userUuid,
              drName: schedule.drName,
            });
          }
          now.add(SLOT_DURATION, SLOT_DURATION_UNIT);
        }
      }
    });

    return dates;
  };

  this._getAppointmentSlots = async ({
    fromDate,
    toDate,
    speciality,
    returnAllSlots = false,
  }) => {
    let schedules = await Schedule.findAll({
      where: { speciality },
      raw: true,
    });
    let setting = await Setting.findOne({ where: {}, raw: true });

    const SLOT_DURATION =
      setting && setting.slotDuration ? setting.slotDuration : 30;
    const SLOT_DURATION_UNIT =
      setting && setting.slotDurationUnit
        ? setting.slotDurationUnit
        : "minutes";
    let dates = [];
    let uniqueTimeSlots = [];
    try {
      if (schedules.length) {
        const startDate = moment(fromDate, DATE_FORMAT);
        const endDate = moment(toDate, DATE_FORMAT);
        let daysDiff = endDate.diff(startDate, "days");
        if (daysDiff < 0) {
          throw new Error(
            "Incorrect date range - fromDate should be greater or equal to toDate day"
          );
        }
        daysDiff++;
        const days = Array.from({ length: daysDiff }).map((day) => {
          const data = {
            day: startDate.format("dddd"),
            date: startDate,
            normDate: startDate.format(DATE_FORMAT),
          };
          const date = startDate.add(1, "days");
          return data;
        });

        schedules.forEach((schedule) => {
          const _dates = true
            ? // schedule.type === "month"
            getMonthSlots({
              schedule,
              days,
              SLOT_DURATION,
              SLOT_DURATION_UNIT,
            })
            : getWeekSlots({
              schedule,
              days,
              SLOT_DURATION,
              SLOT_DURATION_UNIT,
            });
          dates = dates.concat(_dates);
        });
        const appointments = await Appointment.findAll({
          where: {
            speciality,
            slotJsDate: {
              [Op.between]: this.getFilterDates(fromDate, toDate),
            },
            status: "booked",
          },
          raw: true,
        });
        if (returnAllSlots) return dates;

        if (appointments) {
          appointments.forEach((apnmt) => {
            const dateIdx = dates.findIndex(
              (d) =>
                d.slotTime === apnmt.slotTime &&
                d.slotDate === apnmt.slotDate &&
                d.slotDay === apnmt.slotDay &&
                d.userUuid === apnmt.userUuid
            );
            if (dateIdx != -1) {
              dates.splice(dateIdx, 1);
            }
          });
          dates.forEach((slot) => {
            const slt = uniqueTimeSlots.find(
              (us) => us.slotTime === slot.slotTime
            );
            if (!slt) {
              const today = moment().format(DATE_FORMAT);
              if (slot.slotDate === today) {
                if (moment(slot.slotTime, "LT") > moment()) {
                  uniqueTimeSlots.push(slot);
                }
              } else {
                uniqueTimeSlots.push(slot);
              }
            }
          });
        }
      }

      return { dates: uniqueTimeSlots };
    } catch (error) {
      throw error;
    }
  };

  const createAppointment = async ({
    openMrsId,
    patientName,
    locationUuid,
    hwUUID,
    slotDay,
    slotDate,
    slotDuration,
    slotDurationUnit,
    slotTime,
    speciality,
    userUuid,
    drName,
    visitUuid,
    patientId,
  }) => {
    return await Appointment.create({
      slotDay,
      slotDate,
      slotDuration,
      slotDurationUnit,
      slotTime,
      speciality,
      userUuid,
      drName,
      visitUuid,
      patientId,
      status: "booked",
      openMrsId,
      patientName,
      locationUuid,
      hwUUID,
      slotJsDate: moment(
        `${slotDate} ${slotTime}`,
        "DD/MM/YYYY HH:mm A"
      ).format(),
      createdBy: hwUUID,
    });
  };

  this._bookAppointment = async (params) => {
    const {
      slotDay,
      slotDate,
      slotDuration,
      slotDurationUnit,
      slotTime,
      speciality,
      userUuid,
      drName,
      visitUuid,
      patientId,
      openMrsId,
      patientName,
      locationUuid,
      hwUUID,
    } = params;
    try {
      const bookedApnmt = await Appointment.findOne({
        where: {
          slotTime,
          slotDate,
          userUuid,
          status: "booked",
        },
        raw: true,
      });

      if (bookedApnmt) {
        throw new Error("Appointment not available, it's already booked.");
      }

      const visitApnmt = await Appointment.findOne({
        where: {
          visitUuid,
          status: "booked",
        },
        raw: true,
      });
      if (visitApnmt) {
        throw new Error("Appointment for this visit is already present.");
      }

      const data = await createAppointment({
        openMrsId,
        patientName,
        locationUuid,
        hwUUID,
        slotDay,
        slotDate,
        slotDuration,
        slotDurationUnit,
        slotTime,
        speciality,
        userUuid,
        drName,
        visitUuid,
        patientId,
      });
      return {
        data: data.toJSON(),
      };
    } catch (error) {
      throw error;
    }
  };

  this._cancelAppointment = async (
    params,
    validate = true,
    notify = true,
    reschedule = false
  ) => {
    const { id, visitUuid, hwUUID, reason } = params;
    let where = { id };
    if (visitUuid) where.visitUuid = visitUuid;
    const appointment = await Appointment.findOne({
      where,
    });
    if (moment.utc(appointment.slotJsDate) < moment() && validate) {
      return {
        status: false,
        message: "You can not cancel past appointments!",
      };
    }
    const status = reschedule ? "rescheduled" : "cancelled";
    if (appointment) {
      appointment.update({ status, updatedBy: hwUUID, reason });
      if (notify) sendCancelNotificationToWebappDoctor(appointment);
      return {
        status: true,
        message: "Appointment cancelled successfully!",
      };
    } else {
      return {
        status: false,
        message: "Appointment not found!",
      };
    }
  };

  this.getAppointment = async ({ visitUuid }) => {
    return await Appointment.findOne({
      where: { visitUuid, status: "booked" },
    });
  };

  this.rescheduleOrCancelAppointment = async (userUuid) => {
    const todayDate = moment.utc().format();
    const data = await Appointment.findAll({
      where: {
        userUuid,
        slotJsDate: {
          [Op.gt]: todayDate,
        },
        status: "booked",
      },
      order: [["slotJsDate", "DESC"]],
      raw: true,
    });

    if (data && data.length) {
      const [firstSlot] = data;
      const appointments = await this._getAppointmentSlots({
        fromDate: moment().format(DATE_FORMAT),
        toDate: firstSlot.slotDate,
        speciality: firstSlot.speciality,
        returnAllSlots: true,
      });

      const currDrSlots = appointments.filter((a) => a.userUuid === userUuid);

      currDrSlots.forEach((apnmt) => {
        const dateIdx = data.findIndex(
          (d) =>
            d.slotTime === apnmt.slotTime &&
            d.slotDate === apnmt.slotDate &&
            d.slotDay === apnmt.slotDay &&
            d.userUuid === apnmt.userUuid
        );
        if (dateIdx != -1) {
          data.splice(dateIdx, 1);
        }
      });

      asyncForEach(data, async (apnmt) => {
        const appointment = {
          ...apnmt,
          hwUUID: "a4ac4fee-538f-11e6-9cfe-86f436325720", // admin user id, as done by system automatically
          reason: `Doctor's change in schedule.`,
        };
        const { speciality, slotDate } = apnmt;
        const fromDate = (toDate = slotDate);

        const { dates } = await this._getAppointmentSlots({
          fromDate,
          toDate,
          speciality,
        });

        let slot = dates.find(
          (d) => d.slotTime === apnmt.slotTime && d.slotDate === apnmt.slotDate
        );
        if (slot) {
          let apnmtData = { ...apnmt, ...slot };
          ["id", "createdAt", "updatedAt", "slotJsDate"].forEach((key) => {
            delete apnmtData[key];
          });
          await this._cancelAppointment(appointment, true, false, true);
          await this._bookAppointment(apnmtData);
        } else {
          await this._cancelAppointment(appointment, true, false);
          await sendCancelNotification(apnmt);
          await sendCancelNotificationToWebappDoctor(apnmt);
        }
      });
    }
  };

  this._rescheduleAppointment = async ({
    openMrsId,
    patientName,
    locationUuid,
    hwUUID,
    slotDay,
    slotDate,
    slotDuration,
    slotDurationUnit,
    slotTime,
    speciality,
    userUuid,
    drName,
    visitUuid,
    patientId,
    appointmentId,
    reason,
  }) => {
    const cancelled = await this._cancelAppointment(
      { id: appointmentId, userId: hwUUID, reason },
      false,
      null,
      true
    );
    if (cancelled && cancelled.status) {
      return {
        data: await createAppointment({
          openMrsId,
          patientName,
          locationUuid,
          hwUUID,
          slotDay,
          slotDate,
          slotDuration,
          slotDurationUnit,
          slotTime,
          speciality,
          userUuid,
          drName,
          visitUuid,
          patientId,
        }),
      };
    } else {
      return cancelled;
    }
  };

  return this;
})();