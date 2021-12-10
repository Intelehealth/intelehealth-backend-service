const { appointment_schedule: Schedule } = require("../models");
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
      return {
        success: false,
        data: error,
      };
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

  this.getAppointmentSlots = async ({ fromDate, toDate, speciality }) => {
    let schedules = await Schedule.findAll({
      where: { speciality },
      raw: true,
    });
    const DATE_FORMAT = "DD/MM/YYYY";
    const TIME_FORMAT = "LT";
    const SLOT_MINUTES = 30;
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

        let daysToSchedule = [];
        schedules.forEach((schedule) => {
          const slots = schedule.slotSchedule.filter(
            (s) => s.startTime && s.endTime
          );
          const slotDays = slots.map((s) => s.day);
          schedule.daysToSchedule = days.filter((d) =>
            slotDays.includes(d.day)
          );
          console.log("schedule: ", schedule);
          schedule.daysToSchedule.forEach((slot) => {
            console.log("slot: ", slot);
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
                    slotDuration: SLOT_MINUTES,
                    slotDurationUnit: "minutes",
                    slotTime: now.format(TIME_FORMAT),
                    speciality: schedule.speciality,
                    userUuid: schedule.userUuid,
                    drName: schedule.drName,
                  });
                }
                now.add(SLOT_MINUTES, "minutes");
              }
            }
          });
        });
        console.log("schedules: ", schedules);
      }

      return { dates };
    } catch (error) {
      throw error;
    }
  };

  return this;
})();
