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

const {
  visit,
  encounter,
  patient_identifier,
  person_name,
  encounter_type,
  encounter_provider,
  person,
  provider,
  location,
  obs,
  sequelize,
} = require("../openmrs_models");
const { QueryTypes } = require("sequelize");
const { getVisitCountV4 } = require("../controllers/queries");
const { MESSAGE } = require("../constants/messages");
const Constant = require("../constants/constant");

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
            }).catch((err) => {});
          }
        });
      }
    } catch (error) {}
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
    type,
    month,
    year,
    startDate,
    endDate,
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
      if (startDate) update.startDate = startDate;
      if (endDate) update.endDate = endDate;
      if (schedule) {
        const resp = {
          message: MESSAGE.APPOINTMENT.APPOINTMENT_UPDATED_SUCCESSFULLY,
          data: await Schedule.update(update, opts),
        };
        await this.rescheduleOrCancelAppointment(userUuid);

        return resp;
      } else {
        return {
          message: MESSAGE.APPOINTMENT.APPOINTMENT_CREATED_SUCCESSFULLY,
          data: await Schedule.create({
            userUuid,
            slotDays,
            slotSchedule,
            speciality,
            drName,
            type,
            month,
            year,
            startDate,
            endDate,
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
      throw error;
    }
  };

  this.getScheduledMonths = async ({ userUuid, year }) => {
    try {
      //Getting currentYear & nextYear Data
      const nextYear = (+(year) + 1);
      const data = await Schedule.findAll({
        where: {
          userUuid,
          year:{
            [Op.in]:[year,nextYear.toString()]
          },
        },
        raw: true,
      });
      let months = [];
      if (data) {
        data.forEach((d1) => {
          let month = {};
          month.name = d1.month;
          month.year = d1.year;
          months.push(month);
        });
      }
      return months;
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
          status: Constant.BOOKED,
        },
        order: [[Constant.SLOT_JS_DATE, "ASC"]],
        raw: true,
      });

      const visitIds = data.map((v) => v?.visitUuid);

      const visitStatus = await sequelize.query(getVisitCountV4(visitIds), {
        type: QueryTypes.SELECT,
      });

      const visits = await visit.findAll({
        where: {
          uuid: { [Op.in]: visitIds },
        },
        attributes: ["uuid"],
        include: [
          {
            model: encounter,
            as: "encounters",
            attributes: ["encounter_datetime"],
            include: [
              {
                model: obs,
                as: "obs",
                attributes: ["value_text", "concept_id", "value_numeric"],
                required: false
              },
              {
                model: encounter_type,
                as: "type",
                attributes: ["name"],
              }
            ],
          },
          {
            model: patient_identifier,
            as: "patient",
            attributes: ["identifier"],
          },
          {
            model: person_name,
            as: "patient_name",
            attributes: ["given_name", "family_name"],
          },
          {
            model: person,
            as: "person",
            attributes: ["uuid", "gender", "birthdate"],
          },
          {
            model: location,
            as: "location",
            attributes: ["name"],
          },
        ]
      });
      const mergedArray = data.map(x=> ({ ...x, visit: visits.find(y=>y.uuid==x.visitUuid)?.dataValues, visitStatus: visitStatus.find(z=>z.uuid==x.visitUuid)?.Status }));
      return mergedArray;
    } catch (error) {
      throw error;
    }
  };

  this.checkAppointment = async ({ userUuid, fromDate, toDate, speciality }) => {
    try {
      const data = await Appointment.findAll({
        where: {
          userUuid,
          slotJsDate: {
            [Op.between]: this.getFilterDates(fromDate, toDate),
          },
          status: Constant.BOOKED,
          speciality
        },
        order: [[Constant.SLOT_JS_DATE, "ASC"]],
        raw: true,
      });
      return data.length ? true : false;
    } catch (error) {
      throw error;
    }
  };

  this.updateSlotSpeciality = async ({ userUuid, speciality }) => {
    try {
      const data = await Schedule.update({
        speciality
      }, 
      {
        where: {
          userUuid
        }
      });
      return data;
    } catch (error) {
      throw error;
    }
  };

  this.getSpecialitySlots = async ({ speciality, fromDate, toDate }) => {
    try {
      let setting = await Setting.findOne({ where: {}, raw: true });

      const SLOT_DURATION =
        setting && setting.slotDuration ? setting.slotDuration : 30;

      const nowTime = moment().subtract(SLOT_DURATION, "minutes");

      const data = await Appointment.findAll({
        where: {
          speciality,
          slotJsDate: {
            [Op.between]: [
              nowTime.format(),
              this.getFilterDates(fromDate, toDate)[1],
            ],
          },
          status: Constant.BOOKED,
        },
      });

      asyncForEach(data, async (apnmt) => {
        try {
          const url = `/openmrs/ws/rest/v1/patient?q=${apnmt.openMrsId}&v=custom:(uuid,identifiers:(identifierType:(name),identifier),person)`;
          const patient = await axiosInstance.get(url).catch((err) => {});

          if (
            patient &&
            patient.data &&
            patient.data.results &&
            Array.isArray(patient.data.results)
          ) {
            const result = patient.data.results[0];
            if (result && result.person) {
              const name =
                result.person.display || result.person.preferredName.display;

              if (apnmt.patientName !== name) {
                apnmt.patientName = name;
                await apnmt.save();
              }
            }
          }
        } catch (error) {}
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
        },
        raw: true,
      });
      let visits = [];
      if (data.length) {
        let ar1 = data;
        ar1.forEach((visit) => {
          let visit1 = ({} = Object.assign(visit));
          if (visit.status !== Constant.RESCHEDULED) {
            visit1["rescheduledAppointments"] = [];
            let rescheduledAppointment = data.filter(
              (d1) =>
                d1.visitUuid === visit.visitUuid && d1.status === Constant.RESCHEDULED
            );
            visit1.rescheduledAppointments = rescheduledAppointment;
            visits.push(visit1);
          }
        });
      }
      return visits;
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

    schedule.daysToSchedule.forEach((slot) => {
      const slotSchedules = slots.filter(
        (s) => moment(s.date).format(DATE_FORMAT) === slot.normDate
      );
      slotSchedules.forEach((slotSchedule) => {
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
        let daysDiff = endDate.diff(startDate, Constant.DAYS);
        if (daysDiff < 0) {
          throw new Error(
            MESSAGE.APPOINTMENT.INCORRECT_DATE_RANGE_FROMDATE_SHOULD_BE_GREATER_OR_EQUAL_TO_TODATE_DAY
          );
        }
        daysDiff++;
        const days = Array.from({ length: daysDiff }).map((day) => {
          const data = {
            day: startDate.format("dddd"),
            date: startDate,
            normDate: startDate.format(DATE_FORMAT),
          };
          const date = startDate.add(1, Constant.DAYS);
          return data;
        });

        schedules.forEach((schedule) => {
          const _dates = true
            ? getMonthSlots({
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
            status: Constant.BOOKED,
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
                d.speciality === apnmt.speciality
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
    ...rest
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
      status: Constant.BOOKED,
      openMrsId,
      patientName,
      locationUuid,
      hwUUID,
      slotJsDate: moment(
        `${slotDate} ${slotTime}`,
        "DD/MM/YYYY HH:mm A"
      ).format(),
      createdBy: hwUUID,
      ...rest,
    });
  };

  this._bookAppointment = async (params) => {
    const { slotDate, slotTime, speciality, visitUuid } = params;
    try {
      const appntSlots = await this._getAppointmentSlots({
        fromDate: slotDate,
        toDate: slotDate,
        speciality,
      });

      if (appntSlots && appntSlots.dates && Array.isArray(appntSlots.dates)) {
        const matchedApmt = appntSlots.dates.filter((apmt) => {
          return (
            apmt.slotTime === slotTime &&
            apmt.slotDate === slotDate &&
            apmt.speciality === speciality
          );
        });

        if (!matchedApmt.length) {
          throw new Error(MESSAGE.APPOINTMENT.APPOINTMENT_NOT_AVAILABLE_ITS_ALREADY_BOOKED);
        }
      } else {
        throw new Error(MESSAGE.APPOINTMENT.APPOINTMENT_NOT_AVAILABLE_ITS_ALREADY_BOOKED);
      }

      const visitApnmt = await Appointment.findOne({
        where: {
          visitUuid,
          status: Constant.BOOKED,
        },
        raw: true,
      });
      if (visitApnmt) {
        throw new Error(MESSAGE.APPOINTMENT.APPOINTMENT_FOR_THIS_VISIT_IS_ALREADY_PRESENT);
      }

      const data = await createAppointment(params);
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
    // TODO: This code is for validating the cancel appointments.
    // if (moment.utc(appointment.slotJsDate) < moment() && validate) {
    //   return {
    //     status: false,
    //     message: "You can not cancel past appointments!",
    //   };
    // }
    const status = reschedule ? Constant.RESCHEDULED : Constant.CANCELLED;
    if (appointment) {
      appointment.update({ status, updatedBy: hwUUID, reason });
      if (notify) sendCancelNotificationToWebappDoctor(appointment);
      return {
        status: true,
        message: MESSAGE.APPOINTMENT.APPOINTMENT_CANCELLED_SUCCESSFULLY,
      };
    } else {
      return {
        status: false,
        message: MESSAGE.APPOINTMENT.APPOINTMENT_NOT_FOUND,
      };
    }
  };

  this._completeAppointment = async (params) => {
    const { id, visitUuid, hwUUID, reason } = params;
    let where = {
      status: Constant.BOOKED,
    };
    if (visitUuid) where.visitUuid = visitUuid;
    if (id) where.id = id;

    const appointment = await Appointment.findOne({
      where,
    });

    if (appointment) {
      appointment.update({ status: Constant.COMPLETED, updatedBy: hwUUID });
      return {
        status: true,
        message: MESSAGE.APPOINTMENT.APPOINTMENT_COMPLETED_SUCCESSFULLY,
      };
    } else {
      return {
        status: false,
        message: MESSAGE.APPOINTMENT.APPOINTMENT_NOT_FOUND,
      };
    }
  };

  this.getAppointment = async ({ visitUuid }) => {
    return await Appointment.findOne({
      where: { visitUuid, status: Constant.BOOKED },
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
        status: Constant.BOOKED,
      },
      order: [[Constant.SLOT_JS_DATE, "DESC"]],
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
          [Constant.ID, Constant.SLOT_JS_DATE,Constant.CREATED_AT, Constant.UPDATED_AT].forEach((key) => {
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
    patientAge,
    patientGender,
    patientPic,
    hwName,
    hwAge,
    hwGender,
    webApp,
  }) => {
    const cancelled = await this._cancelAppointment(
      { id: appointmentId, userId: hwUUID, reason },
      false,
      null,
      true
    );

    const appointment = await Appointment.findOne({
      where: {
        slotDate,
        slotTime,
        status: Constant.BOOKED,
        userUuid,
      },
      raw: true,
    });

    if (appointment) {
      throw new Error(MESSAGE.APPOINTMENT.ANOTHER_APPOINTMENT_HAS_ALREADY_BEEN_BOOKED_FOR_THIS_TIME_SLOT);
    }

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
          patientAge,
          patientGender,
          patientPic,
          hwName,
          hwAge,
          hwGender
        }),
      };
    } else {
      return cancelled;
    }
  };

  this.startAppointment = async ({ drName, userUuid, appointmentId }) => {
    let appointment = await Appointment.findOne({
      where: {
        id: appointmentId,
      },
    });

    if (appointment) {
      appointment.userUuid = userUuid;
      appointment.drName = drName;
      await appointment.save();
      return appointment;
    } else {
      throw new Error(MESSAGE.APPOINTMENT.APPOINTMENT_NOT_FOUND);
    }
  };

  this.releaseAppointment = async ({ visitUuid }) => {
    let appointment = await Appointment.findOne({
      where: {
        visitUuid,
        status: Constant.BOOKED,
      },
    });

    if (appointment) {
      appointment.userUuid = null;
      appointment.drName = null;
      await appointment.save();
      return appointment;
    } else {
      throw new Error(MESSAGE.APPOINTMENT.APPOINTMENT_NOT_FOUND);
    }
  };

  this.getBookedAppointments = async ({
    fromDate,
    toDate,
    speciality,
    userUuid,
  }) => {
    let where = {
      slotJsDate: {
        [Op.between]: this.getFilterDates(fromDate, toDate),
      },
      status: Constant.BOOKED,
    };

    if (userUuid) where.userUuid = userUuid;
    if (speciality) where.speciality = speciality;

    return await Appointment.findAll({
      where,
      order: [[Constant.SLOT_JS_DATE, "DESC"]],
      raw: true,
    });
  };

  this.getRescheduledAppointments = async ({
    fromDate,
    toDate,
    speciality,
    userUuid,
  }) => {
    let where = {
      slotJsDate: {
        [Op.between]: this.getFilterDates(fromDate, toDate),
      },
      status: Constant.RESCHEDULED,
    };

    if (userUuid) where.userUuid = userUuid;
    if (speciality) where.speciality = speciality;

    return await Appointment.findAll({
      where,
      order: [[Constant.SLOT_JS_DATE, "DESC"]],
      raw: true,
    });
  };

  this.getRescheduledAppointmentsOfVisit = async ({ visitUuid }) => {
    let where = {
      visitUuid,
      status: Constant.RESCHEDULED,
    };
    return await Appointment.findAll({
      where,
      order: [[Constant.SLOT_JS_DATE, "DESC"]],
      raw: true,
    });
  };

  this.getCancelledAppointments = async ({
    fromDate,
    toDate,
    speciality,
    locationUuid,
    userUuid,
  }) => {
    let where = {
      slotJsDate: {
        [Op.between]: this.getFilterDates(fromDate, toDate),
      },
      status: Constant.CANCELLED,
    };

    if (locationUuid) where.locationUuid = locationUuid;
    if (userUuid) where.userUuid = userUuid;
    if (speciality) where.speciality = speciality;

    return await Appointment.findAll({
      where,
      order: [[Constant.SLOT_JS_DATE, "DESC"]],
      raw: true,
    });
  };

  /**
   * updates daysoff schedule if already exist for userUuid
   * @param {string} userUuid
   * @param {object} dates
   */
  this.updateDaysOffSchedule = async ({ userUuid, daysOff, month, year }) => {
    try {
      const opts = { where: { userUuid, month, year } };
      const schedule = await this.getUserAppointmentSchedule(opts);
      let update = { daysOff };
      if (schedule) {
        const resp = {
          message: MESSAGE.APPOINTMENT.SCHEDULE_UPDATED_SUCCESSFULLY,
          data: await Schedule.update(update, opts),
        };
        return resp;
      } else {
        return {
          message: MESSAGE.APPOINTMENT.SCHEDULE_CREATED_SUCCESSFULLY,
          data: await Schedule.create({
            userUuid,
            daysOff,
          }),
        };
      }
    } catch (error) {
      throw error;
    }
  };

  return this;
})();
