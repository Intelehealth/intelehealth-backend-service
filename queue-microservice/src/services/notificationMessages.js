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
const toDataPayload = (payload) => {
  const out = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value === null || value === undefined) continue;
    if (key === "cases") {
      out.caseCount = String(Array.isArray(value) ? value.length : 0);
      continue;
    }
    out[key] = typeof value === "string" ? value : JSON.stringify(value);
  }
  return out;
};

module.exports = { build, toDataPayload, BUILDERS, clockTime };
