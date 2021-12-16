const {
  appointment_schedule: Schedule,
  appointments: Appointment,
  appointment_settings: Setting,
  Sequelize,
} = require("../models");
const Op = Sequelize.Op;

const moment = require("moment");

module.exports = (function () {
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
        return {
          message: "Appointment updated successfully",
          data: await Schedule.update(update, { where: { userUuid } }),
        };
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
      console.log("error: upsertAppointmentSchedule ", error);
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
      console.log("error: getAppointmentSchedule ", error);
      return {
        success: false,
        data: [],
      };
    }
  };
  const DATE_FORMAT = "DD/MM/YYYY";
  const TIME_FORMAT = "LT";

  this.getUserSlots = async ({ userUuid, fromDate, toDate }) => {
    try {
      const data = await Appointment.findAll({
        where: {
          userUuid,
          slotJsDate: {
            [Op.between]: [
              moment(fromDate, DATE_FORMAT).format(),
              moment(toDate, DATE_FORMAT).format(),
            ],
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

  this.getAppointmentSlots = async ({ fromDate, toDate, speciality }) => {
    let schedules = await Schedule.findAll({
      where: { speciality },
      raw: true,
    });
    let setting = await Setting.findOne({ where: {}, raw: true });
    // console.log("setting: ", setting);

    const SLOT_DURATION =
      setting && setting.slotDuration ? setting.slotDuration : 30;
    const SLOT_DURATION_UNIT =
      setting && setting.slotDurationUnit
        ? setting.slotDurationUnit
        : "minutes";
    let dates = [];
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
          const date = startDate.add(1, "days");
          return {
            day: startDate.format("dddd"),
            date,
            normDate: date.format(DATE_FORMAT),
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
                if (now > moment(now).hour(9)) {
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
              [Op.between]: [
                moment(fromDate, DATE_FORMAT).format(),
                moment(toDate, DATE_FORMAT).format(),
              ],
            },
            status: "booked",
          },
          raw: true,
        });
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
        }
      }

      return { dates };
    } catch (error) {
      throw error;
    }
  };

  this.bookAppointment = async (params) => {
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
    } = params;
    try {
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
        slotJsDate: moment(slotDate, DATE_FORMAT).format(),
      });
      return {
        data: data.toJSON(),
      };
    } catch (error) {
      throw error;
    }
  };

  this.cancelAppointment = async (params) => {
    const { id, visitUuid } = params;
    const appointment = await Appointment.findOne({ where: { id: id, visitUuid: visitUuid} });
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

  return this;
})();
