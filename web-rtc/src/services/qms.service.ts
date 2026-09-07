import axios from "axios";
const { logStream } = require("../logger/index");
const { call_recordings } = require("../models");

/**
 * Outbound webhook client for the Queue Management Service (QMS).
 *
 * web-rtc tells QMS when a call connects and when it ends, so a queue entry
 * moves ASSIGNED → CONNECTED → COMPLETED without QMS ever having to poll or
 * call into this service. QMS is addressed by VISIT uuid, because that is the
 * identifier web-rtc already holds — it never sees QMS's queue_entry id.
 *
 * ── TWO RULES THIS FILE EXISTS TO ENFORCE ───────────────────────────────────
 *
 * 1. DEFAULT OFF. Nothing here runs unless QMS_ENABLED=true. A deployment that
 *    does not run QMS behaves exactly as it does today, with no new network
 *    calls and no new failure modes.
 *
 * 2. NEVER BREAK THE CALL. Every function swallows its own errors and returns
 *    a result object instead of throwing. A QMS outage, a timeout, a 500, a
 *    bad URL — none of it may stop a recording from starting or a video call
 *    from proceeding. The queue is downstream of the consultation, never a
 *    precondition for it.
 */

export interface QmsResult {
  attempted: boolean;
  ok: boolean;
  skipped?: string;
  status?: number;
  outcome?: string;
  error?: string;
}

const enabled = (): boolean => String(process.env.QMS_ENABLED).toLowerCase() === "true";

const baseUrl = (): string => (process.env.QMS_BASE_URL || "").replace(/\/+$/, "");

const timeoutMs = (): number => {
  const parsed = Number(process.env.QMS_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 4000;
};

/**
 * Auth for the call to QMS.
 *
 * The caller's own Bearer token is forwarded when there is one, so QMS applies
 * its normal per-user authorisation (LLD §13.1) and the action is attributed to
 * the doctor who actually made it rather than to an anonymous service.
 *
 * `x-qms-secret` is the fallback for calls with no user in the loop — a LiveKit
 * room event, or a server-side sweep. QMS accepts either.
 */
const authHeaders = (authorization?: string | null): Record<string, string> => {
  if (authorization && /^Bearer\s+\S+/i.test(authorization)) {
    return { Authorization: authorization };
  }
  const secret = process.env.QMS_SERVICE_SECRET;
  return secret ? { "x-qms-secret": secret } : {};
};

/**
 * Recover the visit uuid for a room.
 *
 * `stopRecording` is handed only a roomId, but call_recordings already stores
 * room_id alongside visit_id, so the mapping is a single lookup. Returns null
 * when the room was never recorded — in that case the caller must supply the
 * visit id itself.
 */
export const resolveVisitIdFromRoom = async (roomId?: string): Promise<string | null> => {
  if (!roomId) return null;
  try {
    const row = await call_recordings.findOne({
      where: { room_id: roomId },
      order: [["id", "DESC"]],
    });
    return row?.visit_id ?? null;
  } catch (err: any) {
    logStream("error", `QMS: could not resolve visit for room ${roomId}: ${err?.message}`, "qms");
    return null;
  }
};

const post = async (
  path: string,
  body: Record<string, unknown>,
  authorization?: string | null
): Promise<QmsResult> => {
  if (!enabled()) return { attempted: false, ok: false, skipped: "QMS_ENABLED is not true" };
  if (!baseUrl()) {
    logStream("error", "QMS: QMS_ENABLED=true but QMS_BASE_URL is empty", "qms");
    return { attempted: false, ok: false, skipped: "QMS_BASE_URL missing" };
  }

  const url = `${baseUrl()}${path}`;
  try {
    const response = await axios.post(url, body, {
      timeout: timeoutMs(),
      headers: { "Content-Type": "application/json", ...authHeaders(authorization) },
      // Resolve on ANY status so a 404/409 from QMS is handled here as data
      // rather than thrown into the caller's call flow.
      validateStatus: () => true,
    });

    const ok = response.status >= 200 && response.status < 300;
    if (!ok) {
      logStream("error", `QMS: ${path} returned ${response.status}`, "qms");
    }
    return {
      attempted: true,
      ok,
      status: response.status,
      outcome: response.data?.data?.outcome,
    };
  } catch (err: any) {
    // Includes timeouts, DNS failures and non-2xx when validateStatus is unset.
    const status = err?.response?.status;
    logStream("error", `QMS: ${path} failed${status ? ` (${status})` : ""}: ${err?.message}`, "qms");
    return { attempted: true, ok: false, status, error: err?.message };
  }
};

/**
 * The call connected — a participant joined the room.
 * Moves the queue entry to CONNECTED. Safe to send more than once.
 */
export const notifyCallConnected = async (params: {
  visitId?: string;
  roomId?: string;
  doctorId?: string;
  authorization?: string | null;
}): Promise<QmsResult> => {
  if (!enabled()) return { attempted: false, ok: false, skipped: "QMS_ENABLED is not true" };

  const visitId = params.visitId || (await resolveVisitIdFromRoom(params.roomId));
  if (!visitId) {
    logStream("error", `QMS: call-connected with no resolvable visit (room ${params.roomId})`, "qms");
    return { attempted: false, ok: false, skipped: "no visitId" };
  }

  return post(
    `/api/queue/visit/${encodeURIComponent(visitId)}/call-connected`,
    params.doctorId ? { doctorUuid: params.doctorId } : {},
    params.authorization
  );
};

/**
 * The call ended — the room finished or the last participant left.
 *
 * QMS decides what that means: a live call becomes COMPLETED, a call that never
 * connected goes back in the queue. Safe to send more than once.
 */
export const notifyCallDisconnected = async (params: {
  visitId?: string;
  roomId?: string;
  doctorId?: string;
  reason?: string;
  authorization?: string | null;
}): Promise<QmsResult> => {
  if (!enabled()) return { attempted: false, ok: false, skipped: "QMS_ENABLED is not true" };

  const visitId = params.visitId || (await resolveVisitIdFromRoom(params.roomId));
  if (!visitId) {
    logStream("error", `QMS: call-disconnected with no resolvable visit (room ${params.roomId})`, "qms");
    return { attempted: false, ok: false, skipped: "no visitId" };
  }

  const body: Record<string, unknown> = {};
  if (params.doctorId) body.doctorUuid = params.doctorId;
  if (params.reason) body.reason = params.reason;

  return post(
    `/api/queue/visit/${encodeURIComponent(visitId)}/call-disconnected`,
    body,
    params.authorization
  );
};

/** Config snapshot, for the health/debug surface. */
export const qmsStatus = () => ({
  enabled: enabled(),
  baseUrl: baseUrl() || null,
  hasServiceSecret: Boolean(process.env.QMS_SERVICE_SECRET),
  timeoutMs: timeoutMs(),
});
