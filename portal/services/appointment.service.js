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
  sendWebPushNotification
} = require("../handlers/helper");

const {
  visit,
  encounter,
  patient_identifier,
  person_name,
  encounter_type,
  person_attribute,
  person,
  provider,
  location,
  obs,
  sequelize,
  person_attribute_type,
  visit_attribute,
  visit_attribute_type
} = require("../openmrs_models");
const { QueryTypes } = require("sequelize");
const { getVisitCountV4 } = require("../controllers/queries");
const { MESSAGE } = require("../constants/messages");
const { logStream } = require("../logger/index");
const Constant = require("../constants/constant");

module.exports = (function () {
  const DATE_FORMAT = "DD/MM/YYYY";
  const TIME_FORMAT = "LT";
  const FILTER_TIME_DATE_FORMAT = "DD/MM/YYYY HH:mm:ss";

  /**
     * Send appointment cancel notification
     * @param { number } id - Appointment id
     * @param { string } slotTime - Slot time
     * @param { string } patientName - Patient name
     */
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
      logStream('debug','Appointment Service', 'Send Cancel Notification');
      const data = await getDataFromQuery(query);
      if (data && data.length) {
        asyncForEach(data, async (item) => {
          const { token, locale } = item;
          if (token) {
            logStream('debug','Success', 'Send Cancel Notification');
            await sendCloudNotification({
              notification: {
                title:
                  locale === "ru"
                    ? `Запись на прием за ${patientName}(${slotTime}) отменена.`
                    : `Appointment for ${patientName}(${slotTime}) has been cancelled.`,
                body:
                  locale === "ru"
                    ? `Причина: В связи с изменением графика врача`
                    : `Reason : Due to doctor's change in schedule.`,
              },
              regTokens: [token]
            }).catch((err) => { 
              logStream("error", err.message);
            });
          }
        });
      }
    } catch (error) { 
      logStream("error", error.message);
    }
  };

  /**
     * Send appointment cancel notification to doctor
     * @param { number } id - Appointment id
     * @param { string } slotTime - Slot time
     * @param { string } patientName - Patient name
     * @param { string } openMrsId - OpenMRS id
     */
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
      logStream('debug','Appointment Service', 'Send Cancel Notification To Webapp Doctor');
      const data = await getDataFromQuery(query);
      if (data && data.length) {
        asyncForEach(data, async (data) => {
          if (data.webpush_obj) {
            const engTitle = `Appointment for ${patientName}(${slotTime}) has been cancelled.`;
            const ruTitle = `Запись на прием за ${patientName}(${slotTime}) отменена.`;
            const title = data.locale === "ru" ? ruTitle : engTitle;
            logStream('debug','Success', 'Send Cancel Notification To Webapp Doctor');
            sendWebPushNotification({
              webpush_obj: data.webpush_obj,
              title,
              body: openMrsId,
            });
          }
        });
      }
    } catch (error) { 
      logStream("error", error.message);
    }
  };

  /**
     * Get todays date
     */
  const getTodayDate = () => {
    return this.getFilterDates(moment().format("DD/MM/YYYY"), null)[0];
  };

  /**
   * Create & updates a schedule if already exist for userUuid
   * @param {string} userUuid - User uuid
   * @param {string} slotDays - Slot days
   * @param {object} slotSchedule - Slot schedule
   * @param {string} speciality - Doctor speciality
   * @param {string} drName -Doctor name
   * @param {string} type - Type of schedule
   * @param {string} month - Month
   * @param {string} year - Year
   * @param {string} startDate - Start date
   * @param {string} endDate - End date
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
      logStream('debug','Appointment Service', 'Upsert Appointment Schedule');
      const opts = { where: { userUuid, year, month } };
      const schedule = await this.getUserAppointmentSchedule(opts);
      const update = { slotDays };
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
        logStream('debug','Appointment Updated', 'Upsert Appointment Schedule');
        return resp;
      } else {
        logStream('debug','Appointment Created', 'Upsert Appointment Schedule');
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
      logStream("error", error.message);
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

  /**
     * Get scheduled months for a given user or Speciality
     * @param { string } userUuid - User uuid
     * @param { string } year - Year
     * @param { string } speciality = Speciality of User
     */
  this.getScheduledMonths = async ({ userUuid, year, speciality }) => {
    try {
      logStream('debug','Appointment Service', 'Get Scheduled Months');
      //Getting currentYear & nextYear Data
      const nextYear = (+(year) + 1);
      const $where = {
        year: {
          [Op.in]: [year, nextYear.toString()]
        },
        [Op.or]: [{
          userUuid: { [Op.eq]: userUuid }
        }]
      };

      if (speciality) {
        $where[Op.or].push({
          speciality: { [Op.eq]: speciality }
        })
      }
      const data = await Schedule.findAll({
        where: $where,
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
      logStream('debug','Success', 'Get Scheduled Months');
      return months;
    } catch (error) {
      logStream("error", error.message);
      throw error;
    }
  };

  /**
     * Get filtered dates
     * @param { string } fromDate - From date
     * @param { string } toDate - To date
     */
  this.getFilterDates = (fromDate, toDate) => {
    return [
      moment.utc(`${fromDate} 00:00:00`, FILTER_TIME_DATE_FORMAT).format(),
      moment.utc(`${toDate} 23:59:59`, FILTER_TIME_DATE_FORMAT).format(),
    ];
  };

  /**
     * Get user slots
     * @param { string } userUuid - User uuid
     * @param { string } fromDate - From date
     * @param { string } toDate - To date
     */
  this.getUserSlots = async ({ userUuid, fromDate, toDate, speciality = null, pending_visits = null}) => {
    try {
      logStream('debug','Appointment Service', 'Get User Slots');
      const $where = {
        slotJsDate: {
          [Op.between]: this.getFilterDates(fromDate, toDate),
        },
        status: Constant.BOOKED,
        [Op.or]: [{ userUuid: { [Op.eq]: userUuid } }]
      }

      if(speciality) {
        $where[Op.or].push({ speciality: { [Op.eq]: speciality } })
      }
      const data = await Appointment.findAll({
        where: $where,
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
            model: visit_attribute,
            as: "attributes",
            attributes: [["value_reference","value"]],
            required: false,
            include: [
              {
                model: visit_attribute_type,
                as: "attribute_type",
                attributes: ["name", "uuid"],
              }
            ]
          },
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
            include: [
              {
                required: false,
                model: person_attribute,
                as: "person_attribute",
                attributes: ["value", "person_attribute_type_id"],
                where: {person_attribute_type_id: 8}
              }
            ],
          },
          {
            model: person_attribute,
            as: "person_attribute",
            attributes: ["value"],
            include: [
              {
                model: person_attribute_type,
                as: "person_attribute_type",
                attributes: ["name"],
              }
            ],
          },
          {
            model: location,
            as: "location",
            attributes: ["name"],
          },
        ]
      });
      let mergedArray = []
      if(pending_visits !== null) {
        pending_visits = (pending_visits === 'true');
        mergedArray = data.map(x => ({ ...x, visit: visits.find(y => y.uuid == x.visitUuid)?.dataValues, visitStatus: visitStatus.find(z => z.uuid == x.visitUuid)?.Status }));
        mergedArray = mergedArray.filter(obj=>{
          try {
            let callStatusList = obj.visit.attributes.filter(attr=>attr.attribute_type.name === "Call Status");
            let callStatus = JSON.parse(callStatusList?.[0]?.dataValues?.value ?? '{}')
            if(Constant.PENDING_VISIT_BY_CALL_STATUS.includes(callStatus?.callStatus)){
              return  pending_visits
            } 
            return !pending_visits
          } catch (error) {
             logStream("error", error.message)
             return false
          }
        })
      }
      else
        mergedArray = data.map(x => ({ ...x, visit: visits.find(y => y.uuid == x.visitUuid)?.dataValues, visitStatus: visitStatus.find(z => z.uuid == x.visitUuid)?.Status }));
      logStream('debug','Success', 'Get User Slots');
      return mergedArray;
    } catch (error) {
      logStream("error", error.message);
      throw error;
    }
  };

  /**
     * Check if appointment present
     * @param { string } userUuid - User uuid
     * @param { string } fromDate - From date
     * @param { string } toDate - To date
     * @param { string } speciality - Doctor speciality
     */
  this.checkAppointment = async ({ userUuid, fromDate, toDate, speciality }) => {
    try {
      logStream('debug','Appointment Service', 'Check Appointment');
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
      logStream('debug','Success', 'Check Appointment');
      return data.length ? true : false;
    } catch (error) {
      logStream("error", error.message);
      throw error;
    }
  };

  /**
     * Update slot speciality
     * @param { string } userUuid - User uuid
     * @param { string } speciality - Doctor speciality
     */
  this.updateSlotSpeciality = async ({ userUuid, speciality }) => {
    try {
      logStream('debug','Appointment Service', 'Update Slot Speciality');
      const data = await Schedule.update({
        speciality
      },
        {
          where: {
            userUuid
          }
        });
      logStream('debug','Success', 'Update Slot Speciality');
      return data;
    } catch (error) {
      logStream("error", error.message);
      throw error;
    }
  };

  /**
     * Get slots by speciality
     * @param { string } speciality - Speciality
     * @param { string } fromDate - From date
     * @param { string } toDate - To date
     */
  this.getSpecialitySlots = async ({ speciality, fromDate, toDate }) => {
    try {
      logStream('debug','Appointment Service', 'Get Speciality Slots');
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
          const patient = await axiosInstance.get(url).catch((err) => { });

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
        } catch (error) {
          logStream("error", error.message);
         }
      });
      logStream('debug','Success', 'Get Speciality Slots');
      return data;
    } catch (error) {
      logStream("error", error.message);
      throw error;
    }
  };

  /**
     * Get slots
     * @param { string } locationUuid - Location uuid
     * @param { string } fromDate - From date
     * @param { string } toDate - Patient name
     */
  this.getSlots = async ({ locationUuid, fromDate, toDate }) => {
    try {
      logStream('debug','Appointment Service', 'Get Slots');
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
      logStream('debug','Success', 'Get Slots');
      return visits;
    } catch (error) {
      logStream("error", error.message);
      throw error;
    }
  };

  /**
     * Get month slots
     * @param { object } schedule - Schedule
     * @param { string } days - Comma seperated days
     * @param { string } SLOT_DURATION - Slot duration
     * @param { string } SLOT_DURATION_UNIT - Slot duration unit
     */
  const getMonthSlots = ({
    schedule,
    days,
    SLOT_DURATION,
    SLOT_DURATION_UNIT,
  }) => {
    logStream('debug','Appointment Service', 'Get Month Slots');
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
    logStream('debug','Success', 'Get Month Slots');
    return dates;
  };

  /**
     * Get week slots
     * @param { object } schedule - Schedule
     * @param { string } days - Comma seperated days
     * @param { string } SLOT_DURATION - Slot duration
     * @param { string } SLOT_DURATION_UNIT - Slot duration unit
     */
  const getWeekSlots = ({
    schedule,
    days,
    SLOT_DURATION,
    SLOT_DURATION_UNIT,
  }) => {
    logStream('debug','Appointment Service', 'Get Week Slots');
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
    logStream('debug','Success', 'Get Week Slots');
    return dates;
  };

  /**
     * Get appointment slots
     * @param { string } fromDate - From date
     * @param { string } toDate - To date
     * @param { string } speciality - Speciality
     * @param { boolean } returnAllSlots - Whether to return all slots
     */
  this._getAppointmentSlots = async ({
    fromDate,
    toDate,
    speciality,
    returnAllSlots = false,
  }) => {
    logStream('debug','Appointment Service', 'Get Appointment Slots');
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
      logStream('debug','Success', 'Get Appointment Slots');
      return { dates: uniqueTimeSlots };
    } catch (error) {
      logStream("error", error.message);
      throw error;
    }
  };

  /**
     * Create appointment
     * @param { string } openMrsId - OpenMRS id
     * @param { string } patientName - Patient name
     * @param { string } locationUuid - Location uuid
     * @param { string } hwUUID - HW uuid
     * @param {string } slotDay - Slot day
     * @param {string } slotDate - Slot date
     * @param {string } slotDuration - Slot duration
     * @param {string } slotDurationUnit - Slot duration unit
     * @param {string } speciality - Speciality
     * @param {string } userUuid - User uuid
     * @param {string } visitUuid - Visit uuid
     * @param {string } patientId - Patient uuid
     * 
     */
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
    logStream('debug','Appointment Service', 'Create Appointment');
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

  /**
     * Book appointment
     * @param { object } params - (slotDate, slotTime, speciality, visitUuid)
     */
  this._bookAppointment = async (params) => {
    const { slotDate, slotTime, speciality, visitUuid } = params;
    try {
      logStream('debug','API calling', 'Book Appointment');
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
          logStream("error", 'Appointment not available, its already booked.');
          throw new Error(MESSAGE.APPOINTMENT.APPOINTMENT_NOT_AVAILABLE_ITS_ALREADY_BOOKED);
        }
      } else {
        logStream("error", 'Appointment not available, its already booked.');
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
        logStream("error", 'Appointment for this visit is already present');
        throw new Error(MESSAGE.APPOINTMENT.APPOINTMENT_FOR_THIS_VISIT_IS_ALREADY_PRESENT);
      }

      const data = await createAppointment(params);
      logStream('debug','Success', 'Book Appointment');
      return {
        data: data.toJSON(),
      };
    } catch (error) {
      logStream("error", error.message);
      throw error;
    }
  };

  /**
     * Cancel appointment
     * @param { object } params - (id, visitUuid, hwUuid, reason)
     * @param { boolean } validate - Whether to validate
     * @param { boolean } notify - Whether to notify
     * @param { boolean } reschedule - Whether to reschedule
     */
  this._cancelAppointment = async (
    params,
    validate = true,
    notify = true,
    reschedule = false
  ) => {
    logStream('debug','Appointment Service', 'Cancel Appointment');
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
      logStream('debug','Success', 'Cancel Appointment');
      appointment.update({ status, updatedBy: hwUUID, reason });
      if (notify) sendCancelNotificationToWebappDoctor(appointment);
      return {
        status: true,
        message: MESSAGE.APPOINTMENT.APPOINTMENT_CANCELLED_SUCCESSFULLY,
      };
    } else {
      logStream('debug','Appointment not found!', 'Cancel Appointment');
      return {
        status: false,
        message: MESSAGE.APPOINTMENT.APPOINTMENT_NOT_FOUND,
      };
    }
  };

  /**
     * Complete appointment
     * @param { Object } params - (id, visitUuid, hwUuid, reason)
     */
  this._completeAppointment = async (params) => {
    const { id, visitUuid, hwUUID, reason } = params;
    let where = {
      status: Constant.BOOKED,
    };
    logStream('debug','Appointment Service', 'Complete Appointment');
    if (visitUuid) where.visitUuid = visitUuid;
    if (id) where.id = id;

    const appointment = await Appointment.findOne({
      where,
    });

    if (appointment) {
      logStream('debug','Success', 'Complete Appointment');
      appointment.update({ status: Constant.COMPLETED, updatedBy: hwUUID });
      return {
        status: true,
        message: MESSAGE.APPOINTMENT.APPOINTMENT_COMPLETED_SUCCESSFULLY,
      };
    } else {
      logStream('debug', 'Appointment not found!', 'Complete Appointment');
      return {
        status: false,
        message: MESSAGE.APPOINTMENT.APPOINTMENT_NOT_FOUND,
      };
    }
  };

  /**
     * Get appointment
     * @param { object } - (visitUuid)
     */
  this.getAppointment = async ({ visitUuid }) => {
    return await Appointment.findOne({
      where: { visitUuid, status: Constant.BOOKED },
    });
  };

  /**
     * Reschedule or Cancel appointment
     * @param { string } - User uuid
     */
  this.rescheduleOrCancelAppointment = async (userUuid) => {
    logStream('debug','Appointment Service', 'Reschedule Or Cancel Appointment');
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
          [Constant.ID, Constant.SLOT_JS_DATE, Constant.CREATED_AT, Constant.UPDATED_AT].forEach((key) => {
            delete apnmtData[key];
          });
          await this._cancelAppointment(appointment, true, false, true);
          await this._bookAppointment(apnmtData);
          logStream('debug','Success', 'Reschedule Or Cancel Appointment');
        } else {
          await this._cancelAppointment(appointment, true, false);
          await sendCancelNotification(apnmt);
          await sendCancelNotificationToWebappDoctor(apnmt);
          logStream('debug','Success', 'Reschedule Or Cancel Appointment');
        }
      });
    }
  };

  /**
     * Reschedule appointment
     * @param { object } - (openMrsId,patientName,locationUuid,hwUUID,slotDay,slotDate,slotDuration,slotDurationUnit,slotTime,speciality,userUuid,drName,visitUuid,patientId,appointmentId,reason,patientAge,patientGender,patientPic,hwName,hwAge,hwGender,webApp,)
     */
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
    logStream('debug','Appointment Service', 'Reschedule Appointment');
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
      logStream('debug','Success', 'Reschedule Appointment');
      const appointment = await createAppointment({
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
      });

      if(appointment && visitUuid) {
        try{
          await this.removeCallStatus(visitUuid);
        } catch (err) {
          logStream('error', err);
        }
      }
      
      return {
        data: appointment,
      };
    } else {
      return cancelled;
    }
  };

  /**
     * Start appointment
     * @param { object } - (drName, userUuid, appointmentId)
     */
  this.startAppointment = async ({ drName, userUuid, appointmentId }) => {
    logStream('debug','Appointment Service', 'Start Appointment');
    let appointment = await Appointment.findOne({
      where: {
        id: appointmentId,
      },
    });

    if (appointment) {
      appointment.userUuid = userUuid;
      appointment.drName = drName;
      await appointment.save();
      logStream('debug','Success', 'Start Appointment');
      return appointment;
    } else {
      logStream("error", "Appointment not found!");
      throw new Error(MESSAGE.APPOINTMENT.APPOINTMENT_NOT_FOUND);
    }
  };

  /**
     * Release appointment
     * @param { object } - (visitUuid)
     */
  this.releaseAppointment = async ({ visitUuid }) => {
    logStream('debug','Appointment Service', 'Release Appointment');
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
      logStream('debug','Success', 'Release Appointment');
      return appointment;
    } else {
      logStream("error", "Appointment not found!");
      throw new Error(MESSAGE.APPOINTMENT.APPOINTMENT_NOT_FOUND);
    }
  };

  /**
     * Get booked appointments
     * @param { object } - (fromDate, toDate, speciality, userUuid)
     */
  this.getBookedAppointments = async ({
    fromDate,
    toDate,
    speciality,
    userUuid,
  }) => {
    logStream('debug','Appointment Service', 'Get Booked Appointments');
    const where = {
      slotJsDate: {
        [Op.between]: this.getFilterDates(fromDate, toDate),
      },
      status: Constant.BOOKED,
    };

    if (userUuid) where.userUuid = userUuid;
    if (speciality) where.speciality = speciality;
    logStream('debug','Success', 'Get Booked Appointments');
    return await Appointment.findAll({
      where,
      order: [[Constant.SLOT_JS_DATE, "DESC"]],
      raw: true,
    });
  };

  /**
     * Get rescheduled appointments
     * @param { object } - (fromDate, toDate, specilaityy, userUuid)
     */
  this.getRescheduledAppointments = async ({
    fromDate,
    toDate,
    speciality,
    userUuid,
  }) => {
    logStream('debug','Appointment Service', 'get Rescheduled Appointments');
    const where = {
      slotJsDate: {
        [Op.between]: this.getFilterDates(fromDate, toDate),
      },
      status: Constant.RESCHEDULED,
    };

    if (userUuid) where.userUuid = userUuid;
    if (speciality) where.speciality = speciality;
    logStream('debug','Success', 'get Rescheduled Appointments');
    return await Appointment.findAll({
      where,
      order: [[Constant.SLOT_JS_DATE, "DESC"]],
      raw: true,
    });
  };

  /**
     * Get rescheduled appointments of visit
     * @param { object } - (visitUuid)
     */
  this.getRescheduledAppointmentsOfVisit = async ({ visitUuid }) => {
    logStream('debug','Appointment Service', 'Get Rescheduled Appointments Of Visit');
    const where = {
      visitUuid,
      status: Constant.RESCHEDULED,
    };
    logStream('debug','Success', 'Get Rescheduled Appointments Of Visit');
    return await Appointment.findAll({
      where,
      order: [[Constant.SLOT_JS_DATE, "DESC"]],
      raw: true,
    });
  };

  /**
     * Get cancelled appointments
     * @param { object } - (fromDate, toDate, speciality, locationUuid,userUuid)
     */
  this.getCancelledAppointments = async ({
    fromDate,
    toDate,
    speciality,
    locationUuid,
    userUuid,
  }) => {
    logStream('debug','Appointment Service', 'Get Cancelled Appointments');
    const where = {
      slotJsDate: {
        [Op.between]: this.getFilterDates(fromDate, toDate),
      },
      status: Constant.CANCELLED,
    };

    if (locationUuid) where.locationUuid = locationUuid;
    if (userUuid) where.userUuid = userUuid;
    if (speciality) where.speciality = speciality;
    logStream('debug','Success', 'Get Cancelled Appointments');
    return await Appointment.findAll({
      where,
      order: [[Constant.SLOT_JS_DATE, "DESC"]],
      raw: true,
    });
  };

  /**
   * updates daysoff schedule if already exist for userUuid
   * @param {string} userUuid - User uuid
   * @param {string[]} daysOff - Day off's
   * @param {string} month - Month
   * @param {string} year - Year
   */
  this.updateDaysOffSchedule = async ({ userUuid, daysOff, month, year }) => {
    try {
      logStream('debug','Appointment Service', 'Update Days Off Schedule');
      const opts = { where: { userUuid, month, year } };
      const schedule = await this.getUserAppointmentSchedule(opts);
      const update = { daysOff };
      if (schedule) {
        logStream('debug','Schedule Updated', 'Update Days Off Schedule');
        const resp = {
          message: MESSAGE.APPOINTMENT.SCHEDULE_UPDATED_SUCCESSFULLY,
          data: await Schedule.update(update, opts),
        };
        return resp;
      } else {
        logStream('debug','Schedule Created', 'Update Days Off Schedule');
        return {
          message: MESSAGE.APPOINTMENT.SCHEDULE_CREATED_SUCCESSFULLY,
          data: await Schedule.create({
            userUuid,
            daysOff,
          }),
        };
      }
    } catch (error) {
      logStream("error", error.message);
      throw error;
    }
  };

   /**
   * validate the dayoff for current user
   * @param {string} userUuid - User uuid
   * @param {string} date - date
   * @param {string} time - time
   */
  this.validateDayOff = async ({ userUuid, month, year, date, time }) => {
    try {
      const opts = { where: { userUuid, month, year  } };
    
      const schedule = await this.getUserAppointmentSchedule(opts);
      if(schedule?.daysOff?.includes(date)) throw new Error(MESSAGE.APPOINTMENT.CANNOT_SCHEDULE_THE_VISIT);
      
      return {schedule};
    } catch (error) {
      throw error;
    }
  };

  /**
   * remove the call status from visit attributes.
   * @param {visitUuid} visitUuid 
   */
  this.removeCallStatus = async (visitUuid) => {
    const currentVisit = await visit.findOne({
      where: {
        uuid: { [Op.eq]: visitUuid },
      },
      attributes: ["uuid"],
      include: [
        {
          model: visit_attribute,
          as: "attributes",
          attributes: [["value_reference","value"], 'uuid'],
          required: false,
          include: [
            {
              model: visit_attribute_type,
              as: "attribute_type",
              attributes: ["name", "uuid"],
            }
          ]
        }
      ]
    });
    if(currentVisit) {
      const callStatusList = currentVisit.attributes.filter(attr=>attr.attribute_type.name === "Call Status")
      if(callStatusList && callStatusList.length > 0){
        try {
          const dataValues = callStatusList[0].dataValues;
          let callStatus = JSON.parse(dataValues?.value ?? '{}')
          if(Constant.PENDING_VISIT_BY_CALL_STATUS.includes(callStatus?.callStatus)) {
            await visit_attribute.destroy({
              where: { uuid: dataValues.uuid }
            }); 
          }
        } catch (error) { console.error("Unable to delete the call status visit attribute")}
      }
    }
  }

  return this;
})();
