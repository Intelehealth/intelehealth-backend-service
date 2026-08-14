const {
  appointment_schedule: Schedule,
  appointments: Appointment,
  appointment_settings: Setting,
  Sequelize,
} = require("../models");
const Op = Sequelize.Op;

const moment = require("moment");
const axios = require("axios");
const { MESSAGE } = require("../constants/messages");
const { logStream } = require("../logger/index");
const Constant = require("../constants/constant");

module.exports = (function () {
  const DATE_FORMAT = "DD/MM/YYYY";
  const TIME_FORMAT = "LT";
  const FILTER_TIME_DATE_FORMAT = "DD/MM/YYYY HH:mm:ss";
  // Slots are IST-based. 
  const APP_UTC_OFFSET = "+05:30";
  // A slot's absolute start time, anchored to IST.
  const slotMoment = (slotDate, slotTime) =>
    moment.utc(`${slotDate} ${slotTime}`, `${DATE_FORMAT} ${TIME_FORMAT}`, true)
      .utcOffset(APP_UTC_OFFSET, true);

  const getFilterDates = (fromDate, toDate) => {
    return [
      moment.utc(`${fromDate} 00:00:00`, FILTER_TIME_DATE_FORMAT).format(),
      moment.utc(`${toDate} 23:59:59`, FILTER_TIME_DATE_FORMAT).format(),
    ];
  };

  const ACCEPTED_DATE_FORMATS = [
    "DD/MM/YYYY",
    "D/M/YYYY",
    "YYYY-MM-DD",
    "YYYY/MM/DD",
    moment.ISO_8601,
  ];
  const stripAstral = (input) =>
    String(input || "")
      .replace(/[\u{10000}-\u{10FFFF}]/gu, "")
      .replace(/\s+/g, " ")
      .trim();

  const normalizeDate = (input) => {
    const m = moment(String(input || ""), ACCEPTED_DATE_FORMATS, true);
    if (!m.isValid()) {
      throw new Error(
        `Invalid date "${input}". Use DD/MM/YYYY or YYYY-MM-DD.`
      );
    }
    return m.format(DATE_FORMAT);
  };

  const getMonthSlots = ({ schedule, days, SLOT_DURATION,SLOT_GAP,SLOT_DURATION_UNIT }) => {
    let dates = [];
    const slots = schedule.slotSchedule.filter((s) => s.startTime && s.endTime);
    const slotDays = slots
      .map((s) => moment(s.date).get("date"))
      .sort((a, b) => a - b);

    schedule.daysToSchedule = days.filter((d) => {
      const date = moment(d.date, DATE_FORMAT).get("date");
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
            now.add(SLOT_DURATION + SLOT_GAP,SLOT_DURATION_UNIT);
          }
        }
      });
    });
    return dates;
  };

  const MAX_SLOTS = 6;

  const computeOpenSlots = async ({ userUuid, speciality, fromDate, toDate }) => {
    fromDate = normalizeDate(fromDate);
    toDate = normalizeDate(toDate);

    const scheduleWhere = { speciality };
    if (userUuid) scheduleWhere.userUuid = userUuid;

    const schedules = await Schedule.findAll({ where: scheduleWhere, raw: true });
    if (!schedules.length) return [];

    const setting = await Setting.findOne({ where: {}, raw: true });
    const SLOT_DURATION =
      setting && setting.slotDuration ? setting.slotDuration : 30;
    const SLOT_GAP = 5; // added 5 minutes more (10 min +5min breaktime).
    const SLOT_DURATION_UNIT =
      setting && setting.slotDurationUnit ? setting.slotDurationUnit : "minutes";

    const startDate = moment(fromDate, DATE_FORMAT);
    const endDate = moment(toDate, DATE_FORMAT);
    let daysDiff = endDate.diff(startDate, Constant.DAYS);
    if (daysDiff < 0) {
      throw new Error(
        MESSAGE.APPOINTMENT
          .INCORRECT_DATE_RANGE_FROMDATE_SHOULD_BE_GREATER_OR_EQUAL_TO_TODATE_DAY
      );
    }
    daysDiff++;

    const days = Array.from({ length: daysDiff }).map(() => {
      const data = {
        day: startDate.format("dddd"),
        date: startDate.format(DATE_FORMAT),
        normDate: startDate.format(DATE_FORMAT),
      };
      startDate.add(1, Constant.DAYS);
      return data;
    });

    let dates = [];
    schedules.forEach((schedule) => {
      dates = dates.concat(
        getMonthSlots({ schedule, days, SLOT_DURATION,SLOT_GAP, SLOT_DURATION_UNIT })
      );
    });

    const appointmentWhere = {
      speciality,
      slotJsDate: { [Op.between]: getFilterDates(fromDate, toDate) },
      status: Constant.BOOKED,
    };
    if (userUuid) appointmentWhere.userUuid = userUuid;
    const appointments = await Appointment.findAll({
      where: appointmentWhere,
      raw: true,
    });

    appointments.forEach((apnmt) => {
      const idx = dates.findIndex(
        (d) =>
          d.userUuid === apnmt.userUuid &&
          d.slotTime === apnmt.slotTime &&
          d.slotDate === apnmt.slotDate &&
          d.slotDay === apnmt.slotDay
      );
      if (idx !== -1) dates.splice(idx, 1);
    });

    const now = moment();
    const openSlots = [];
    dates.forEach((slot) => {
      const seen = openSlots.find(
        (us) =>
          us.userUuid === slot.userUuid &&
          us.slotTime === slot.slotTime &&
          us.slotDate === slot.slotDate
      );
      if (seen) return;
      const slotStart = slotMoment(slot.slotDate, slot.slotTime);
      if (!slotStart.isValid() || slotStart.isSameOrBefore(now)) return;

      openSlots.push({
        ...slot,
        startsAt: slotStart.valueOf(),
        label: `${slotStart.format("ddd D MMM")}, ${slot.slotTime}`,
      });
    });

    openSlots.sort((a, b) => a.startsAt - b.startsAt);
    return openSlots;
  };

  this.getUserAppointmentSlots = async ({
    userUuid,
    speciality,
    fromDate,
    toDate,
    limit,
  }) => {
    logStream("debug", "Turn Appointment Service", "Get User Appointment Slots");
    const openSlots = await computeOpenSlots({
      userUuid,
      speciality,
      fromDate,
      toDate,
    });
    const cap = Math.min(Math.max(parseInt(limit, 10) || MAX_SLOTS, 1), MAX_SLOTS);
    const capped = openSlots.slice(0, cap).map(({ startsAt, ...s }) => s);
    logStream("debug", "Success", "Get User Appointment Slots");
    return { dates: capped, count: capped.length };
  };

  const buildCallLink = async (appointment) => {
    const base = (process.env.WEBRTC_API_URL || "").replace(/\/+$/, "");
    if (!base) {
      logStream("error", "WEBRTC_API_URL not set — cannot build call link");
      return null;
    }
    if (!appointment.patientId) return null;

    const tail = Number(process.env.TURN_CALL_LINK_OPEN_AFTER_MINUTES) || 120;
    const minsUntilSlot = moment(appointment.slotJsDate).diff(moment(), "minutes");
    const ttlMinutes = Math.max(60, minsUntilSlot + tail);

    try {
      const { data } = await axios.post(
        `${base}/magic-link`,
        {
          visitUuid: appointment.visitUuid,
          roomId: appointment.patientId,
          doctorName: appointment.drName,
          patientName: appointment.patientName,
          ttlMinutes,
        },
        { timeout: 15000 }
      );
      if (!data || !data.success || !data.url) {
        logStream("error", `magic-link returned no url: ${JSON.stringify(data)}`);
        return null;
      }
      return { url: data.url, magicToken: data.magicToken };
    } catch (err) {
      logStream(
        "error",
        `magic-link call failed: ${err.response ? JSON.stringify(err.response.data) : err.message}`
      );
      return null;
    }
  };

  this.bookAppointment = async (params = {}) => {
    logStream("debug", "Turn Appointment Service", "Book Appointment");

    let {
      slotDate,
      slotTime,
      slotDay,
      slotDuration,
      slotDurationUnit,
      speciality,
      userUuid,
      drName,
      visitUuid,
      patientId,
      patientName,
      openMrsId,
      locationUuid,
      hwUUID,
    } = params;

    const required = {
      slotDate,
      slotTime,
      speciality,
      userUuid,
      drName,
      visitUuid,
      patientId,
      patientName,
      openMrsId,
      locationUuid,
    };
    for (const [key, value] of Object.entries(required)) {
      if (!value || typeof value !== "string") {
        throw new Error(`Invalid request, ${key} is missing.`);
      }
    }

    slotDate = normalizeDate(slotDate);
    slotDay = moment(slotDate, DATE_FORMAT).format("dddd");
    patientName = stripAstral(patientName) || "Patient";

    const existing = await Appointment.findOne({
      where: { visitUuid, status: Constant.BOOKED },
      raw: true,
    });
    if (existing) {
      const link = await buildCallLink(existing);
      logStream("debug", "Visit already booked — returning existing", "Book Appointment");
      return {
        alreadyBooked: true,
        data: existing,
        joinUrl: link ? link.url : null,
        magicToken: link ? link.magicToken : null,
      };
    }

    const openSlots = await computeOpenSlots({
      userUuid,
      speciality,
      fromDate: slotDate,
      toDate: slotDate,
    });
    const stillOpen = openSlots.some(
      (s) =>
        s.userUuid === userUuid &&
        s.slotDate === slotDate &&
        s.slotTime === slotTime
    );
    if (!stillOpen) {
      throw new Error(
        MESSAGE.APPOINTMENT.APPOINTMENT_NOT_AVAILABLE_ITS_ALREADY_BOOKED
      );
    }

    const setting = await Setting.findOne({ where: {}, raw: true });
    const created = await Appointment.create({
      slotDay,
      slotDate,
      slotTime,
      slotDuration:
        Number(slotDuration) ||
        (setting && setting.slotDuration ? setting.slotDuration : 30),
      slotDurationUnit:
        slotDurationUnit ||
        (setting && setting.slotDurationUnit ? setting.slotDurationUnit : "minutes"),
      speciality,
      userUuid,
      drName,
      visitUuid,
      patientId,
      status: Constant.BOOKED,
      openMrsId,
      patientName,
      locationUuid,
      hwUUID: hwUUID || null,
      slotJsDate: moment(
        `${slotDate} ${slotTime}`,
        "DD/MM/YYYY HH:mm A"
      ).format(),
      createdBy: hwUUID || userUuid,
      type: "appointment",
    });

    const appointment = created.toJSON();
    const link = await buildCallLink(appointment);

    logStream("debug", "Success", "Book Appointment");
    return {
      alreadyBooked: false,
      data: appointment,
      joinUrl: link ? link.url : null,
      magicToken: link ? link.magicToken : null,
    };
  };

  return this;
})();
