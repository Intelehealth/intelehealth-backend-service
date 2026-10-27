const { EVENT } = require("../constants/events");

/**
 * Notification copy, per event and locale.
 *
 * Mirrors portal's convention: an English string and a Russian one, chosen by
 * `user_settings.locale` (portal/services/appointment.service.js does exactly
 * this, `locale === "ru" ? ru : en`). Anything other than "ru" falls back to
 * English, same as portal.
 *
 * Pure functions — no I/O — so the wording is unit-testable without a database
 * or a Firebase credential.
 */

const plural = (n, one, many) => (n === 1 ? one : many);

/**
 * Local clock time for an absolute instant, e.g. "2:35 PM" / "14:35".
 *
 * Notification text is a snapshot the moment it is written, so it states the
 * expected TIME rather than a duration that is stale as soon as it is read.
 * The countdown itself belongs to the client, which recomputes it from `etaAt`
 * in the data payload.
 */
const clockTime = (etaAt, locale) => {
  if (!etaAt) return null;
  const d = new Date(etaAt);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return d.toLocaleTimeString(locale === "ru" ? "ru-RU" : "en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: process.env.TZ || undefined,
    });
  } catch (_) {
    return d.toISOString().slice(11, 16);
  }
};


const BUILDERS = {
  /** To the health worker, once, on submit. */
  [EVENT.QUEUED]: (p, locale) => {
    const at = clockTime(p.etaAt, locale);
    if (locale === "ru") {
      return {
        title: "Пациент добавлен в очередь",
        body: `Вы ${p.position}-й в очереди` + (at ? `, ожидаемое время приёма ~${at}.` : "."),
      };
    }
    return {
      title: "Patient added to the queue",
      body:
        `You are number ${p.position} in the ${p.speciality} queue` +
        (at ? `, expected around ${at}.` : "."),
    };
  },

  /**
   * To every doctor in the speciality, once, on submit.
   *
   * Carries the emergency level and the queue depth so a doctor can judge
   * whether to pick it up — but no chief complaint, symptoms or vitals. Push
   * payloads stay free of clinical content (LLD §13.3).
   */
  [EVENT.NEW_CASE]: (p, locale) => {
    const urgent = p.emergencyLevel === "CRITICAL" || p.emergencyLevel === "HIGH";
    if (locale === "ru") {
      return {
        title: urgent
          ? `Срочный случай — ${p.speciality}`
          : `Новый случай — ${p.speciality}`,
        body:
          `Уровень: ${p.emergencyLevel}.` +
          (Number.isFinite(p.waiting) ? ` Ожидают: ${p.waiting}.` : ""),
      };
    }
    return {
      title: urgent
        ? `Urgent case waiting — ${p.speciality}`
        : `New case waiting — ${p.speciality}`,
      body:
        `Priority: ${p.emergencyLevel}.` +
        (Number.isFinite(p.waiting)
          ? ` ${p.waiting} ${plural(p.waiting, "patient", "patients")} in the queue.`
          : ""),
    };
  },

  [EVENT.POSITION]: (p, locale) => {
    const at = clockTime(p.etaAt, locale);
    if (locale === "ru") {
      return {
        title: `Вы ${p.position}-й в очереди`,
        body: at ? `Ожидаемое время приёма ~${at}.` : "Позиция в очереди обновлена.",
      };
    }
    return {
      title: `You are number ${p.position} in the queue`,
      body: at ? `Expected around ${at}.` : "Your position in the queue has changed.",
    };
  },

  [EVENT.EWT]: (p, locale) => {
    const at = clockTime(p.etaAt, locale);
    if (locale === "ru") {
      return {
        title: "Время ожидания обновлено",
        body: at ? `Новое ожидаемое время приёма ~${at}.` : "Примерное время ожидания изменилось.",
      };
    }
    return {
      title: "Wait time updated",
      body: at ? `Now expected around ${at}.` : "The estimated wait has changed.",
    };
  },

  [EVENT.READY]: (_p, locale) =>
    locale === "ru"
      ? { title: "Врач готов принять вас", body: "Нажмите, чтобы начать видеоконсультацию." }
      : { title: "A doctor is ready for you", body: "Tap to start the video consultation." },

  [EVENT.ESCALATED]: (p, locale) => {
    if (locale === "ru") {
      return {
        title: "Случай передан в приоритет",
        body: p.capMinutes
          ? `Ожидание превысило ${p.capMinutes} мин. Случай перемещён в начало очереди.`
          : "Случай перемещён в начало очереди.",
      };
    }
    return {
      title: "Case moved to the front of the queue",
      body: p.capMinutes
        ? `Waiting longer than the ${p.capMinutes}-minute limit. It is now first in line.`
        : "It is now first in line.",
    };
  },

  [EVENT.CANCELLED]: (p, locale) =>
    locale === "ru"
      ? { title: "Случай отменён", body: p.reason ? `Причина: ${p.reason}` : "Случай удалён из очереди." }
      : {
          title: "Case cancelled",
          body: p.reason ? `Reason: ${p.reason}` : "The case has been removed from the queue.",
        },

  /**
   * To each health worker with a case waiting, when a doctor there goes away
   * or comes back from away.
   */
  [EVENT.DOCTOR_STATUS]: (p, locale) => {
    const away = p.doctorStatus === "away";
    const back = p.doctorStatus === "online" && p.previousDoctorStatus === "away";
    if (locale === "ru") {
      if (away) {
        return {
          title: `Врач отошёл — ${p.speciality}`,
          body: "Пациент остаётся в очереди. Ожидание может увеличиться.",
        };
      }
      if (back) {
        return { title: `Врач вернулся — ${p.speciality}`, body: "Врач снова принимает пациентов из очереди." };
      }
      return { title: `Статус врача — ${p.speciality}`, body: `Врач сейчас: ${p.doctorStatus}.` };
    }
    if (away) {
      return {
        title: `A doctor is away — ${p.speciality}`,
        body: "Your patient stays in the queue. The wait may be longer.",
      };
    }
    if (back) {
      return { title: `A doctor is back — ${p.speciality}`, body: "A doctor is taking patients from the queue again." };
    }
    return { title: `Doctor status — ${p.speciality}`, body: `A doctor is now ${p.doctorStatus}.` };
  },

  [EVENT.DOCTOR_QUEUE_UPDATE]: (p, locale) => {
    const count = Array.isArray(p.cases) ? p.cases.length : 0;
    if (locale === "ru") {
      return {
        title: "Очередь обновлена",
        body: `${count} ${plural(count, "пациент ожидает", "пациентов ожидают")}${
          p.speciality ? ` — ${p.speciality}` : ""
        }.`,
      };
    }
    return {
      title: "Queue updated",
      body: `${count} ${plural(count, "patient is", "patients are")} waiting${
        p.speciality ? ` in ${p.speciality}` : ""
      }.`,
    };
  },
};

/**
 * @param payload one entry from a notification batch
 * @param locale  user_settings.locale ("ru" or anything else)
 * @returns { title, body }
 */
const build = (payload, locale = "en") => {
  const builder = BUILDERS[payload.event];
  if (!builder) {
    return {
      title: locale === "ru" ? "Обновление очереди" : "Queue update",
      body: payload.event,
    };
  }
  return builder(payload, locale);
};

/**
 * FCM rejects a data payload whose values are not all strings — portal logs
 * this as an error at the call site but still sends. Coercing here means the
 * message actually goes out instead of failing at Google's end.
 *
 * Clinical content never enters this object; it carries identifiers, position
 * and ETA only (LLD §13.3).
 */
/** Every QMS push carries this as data.type; data.event says which one it is. */
const NOTIFICATION_TYPE = "Queue Update";

const toDataPayload = (payload, title = null) => {
  const out = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value === null || value === undefined) continue;
    if (key === "cases") {
      out.caseCount = String(Array.isArray(value) ? value.length : 0);
      continue;
    }
    out[key] = typeof value === "string" ? value : JSON.stringify(value);
  }
  // Client contract: etaTime is the expected instant (same value as etaAt),
  // title is the event's notification title, type is fixed.
  if (out.etaAt) out.etaTime = out.etaAt;
  out.title = title || build(payload).title;
  out.type = NOTIFICATION_TYPE;
  return out;
};

module.exports = { build, toDataPayload, BUILDERS, clockTime, NOTIFICATION_TYPE };
