const {
  appointment_schedule: Schedule,
  appointments: Appointment,
  appointment_settings: Setting,
  Sequelize,
} = require("../models");
const Op = Sequelize.Op;

const moment = require("moment");
const { asyncForEach, getDataFromQuery } = require("../handlers/helper");

module.exports = (function () {
  const DATE_FORMAT = "DD/MM/YYYY";
  const TIME_FORMAT = "LT";
  const FILTER_TIME_DATE_FORMAT = "DD/MM/YYYY HH:mm:ss";

  const sendCancelNotification = async ({ id, slotTime, patientName }) => {
    const query = `
    select
    a.id,
    u.device_reg_token as token
from
    appointments a
    INNER JOIN user_settings u ON u.user_uuid = a.hwUUID
where
    a.id = ${id};`;
    try {
      const data = await getDataFromQuery(query);
      if (data && data.length) {
        asyncForEach(data, async (item) => {
          const { token } = item;
          if (token) {
            await sendCloudNotification({
              title: `Appointment for ${patientName}(${slotTime}) has been cancelled.`,
              body: `Reason : Due to doctor's change in schedule.`,
              data: {},
              regTokens: [token],
            }).catch((err) => {});
          }
        });
      }
    } catch (error) {}
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
  }) => {
    try {
      const schedule = await this.getUserAppointmentSchedule({
        where: {
          userUuid,
        },
      });
      let update = {};
      if (slotDays) update.slotDays = slotDays;
      if (slotSchedule) update.slotSchedule = slotSchedule;
      if (slotSchedule) update.drName = drName;
      if (schedule) {
        const resp = {
          message: "Appointment updated successfully",
          data: await Schedule.update(update, { where: { userUuid } }),
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
  this.getUserAppointmentSchedule = async (opts = {}, method = "findOne") => {
    try {
      return await Schedule[method](opts);
    } catch (error) {
      return {
        success: false,
        data: [],
      };
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
          // const date = startDate.add(1, "days");
          return {
            day: startDate.format("dddd"),
            date: startDate,
            normDate: startDate.format(DATE_FORMAT),
          };
        });

        schedules.forEach((schedule) => {
          const slots = schedule.slotSchedule.filter(
            (s) => s.startTime && s.endTime
          );
          const slotDays = slots.map((s) => s.day);
          schedule.daysToSchedule = days.filter((d) =>
            slotDays.includes(d.day)
          );

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
      console.log(
        " slotTime,  slotDate, userUuid,: ",
        slotTime,
        slotDate,
        userUuid
      );

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

      const data = await Appointment.create({
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
      });
      return {
        data: data.toJSON(),
      };
    } catch (error) {
      throw error;
    }
  };

  this._cancelAppointment = async (params) => {
    const { id, visitUuid } = params;
    const appointment = await Appointment.findOne({
      where: { id: id, visitUuid: visitUuid },
    });
    if (moment.utc(appointment.slotJsDate) < moment()) {
      return {
        status: false,
        message: "You can not cancel past appointments!",
      };
    }
    if (appointment) {
      appointment.update({ status: "cancelled" });
      return {
        status: true,
        message: "Appointment cancelled successfully!",
      };
    } else {
      return {
        status: false,
        message: "Appointment not found this visit uuid!",
      };
    }
  };

  this.getAppointment = async ({ visitUuid }) => {
    return await Appointment.findOne({
      where: { visitUuid, status: "booked" },
    });
  };

  this.rescheduleOrCancelAppointment = async (userUuid) => {
    const todayDate = getTodayDate();
    const data = await Appointment.findAll({
      where: {
        userUuid,
        slotJsDate: {
          [Op.gte]: todayDate,
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
        const appointment = { ...apnmt };
        const { speciality, slotDate } = apnmt;
        const fromDate = (toDate = slotDate);
        const { dates } = await this._getAppointmentSlots({
          fromDate,
          toDate,
          speciality,
        });

        const canceled = await this._cancelAppointment(appointment);

        if (dates.length) {
          let apnmtData = { ...apnmt, ...dates[0] };
          ["id", "createdAt", "updatedAt", "slotJsDate"].forEach((key) => {
            delete apnmtData[key];
          });

          this._bookAppointment(apnmtData);
        } else {
          sendCancelNotification(apnmt);
        }
      });
    }
  };

  return this;
})();
