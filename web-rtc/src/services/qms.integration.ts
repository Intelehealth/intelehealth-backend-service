/**
 * QMS (Queue Management System) integration — FEATURE-FLAGGED.
 *
 * All calls here are gated behind QMS_ENABLED and are fire-and-forget:
 *  - if QMS_ENABLED !== 'true'  -> no-op, existing behaviour unchanged
 *  - if the queue-microservice is down -> the error is swallowed and logged,
 *    it must NEVER break the WebRTC call flow.
 *
 * Env vars (web-rtc .env):
 *   QMS_ENABLED=true|false
 *   QMS_BASE_URL=http://queue-microservice:3600
 *   QMS_SERVICE_SECRET=<same secret as queue-microservice>
 */
import axios from "axios";
const { logStream } = require("../logger/index");

function qmsEnabled(): boolean {
  return process.env.QMS_ENABLED === "true";
}

async function post(path: string, body: Record<string, any>): Promise<void> {
  if (!qmsEnabled()) return; // flag off -> do nothing
  try {
    await axios.post(`${process.env.QMS_BASE_URL}${path}`, body, {
      headers: { "x-qms-secret": process.env.QMS_SERVICE_SECRET || "" },
      timeout: 4000,
    });
  } catch (err: any) {
    // swallow — QMS is an add-on, its failure must not affect the call
    logStream("error", `QMS ${path} failed: ${err?.message}`, "qms.integration");
  }
}

/** Call started -> mark the queue entry IN_CALL. Wire into startRecording. */
export function qmsCallStarted(p: { visitId: string; doctorId: string; roomId: string }): void {
  // not awaited on purpose (fire-and-forget)
  void post("/queue/in-call", { visitUuid: p.visitId, doctorId: p.doctorId, roomId: p.roomId });
}

/**
 * Call ended -> mark the queue entry COMPLETED. Wire into stopRecording.
 * stopRecording only knows the roomId, so either identifier is accepted.
 */
export function qmsCallEnded(p: { visitId?: string; roomId?: string }): void {
  void post("/queue/complete", { visitUuid: p.visitId, roomId: p.roomId });
}
