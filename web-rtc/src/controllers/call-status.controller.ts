import { Request, Response } from "express";
import { notifyCallConnected, notifyCallDisconnected, qmsStatus } from "../services/qms.service";
const { logStream } = require("../logger/index");

/**
 * Call-lifecycle webhooks: connect and disconnect.
 *
 * The clients (Android HW app, Angular doctor webapp) call these when a video
 * call actually starts and when it ends, and web-rtc forwards the event to QMS
 * so the queue entry's status follows the real call.
 *
 * Why these exist as their own endpoints rather than only piggy-backing on
 * startRecording/stopRecording: a consultation can happen with recording turned
 * off, and in that case there is no other moment web-rtc learns the call began.
 * The recording hooks are kept as well (see main.controller), so a deployment
 * gets the status update from whichever path it already uses.
 *
 * Everything is best-effort. These endpoints answer 200 with what happened even
 * when QMS is unreachable, because a queue update failing must not read to the
 * client as the call itself failing.
 */
export class CallStatusController {
  /** The caller's own Bearer token, forwarded to QMS for per-user authorisation. */
  private static authOf(req: Request): string | null {
    return req.header("Authorization") ?? null;
  }

  /**
   * POST /api/call/connected
   * body: { visitId?, roomId?, doctorId? }  — one of visitId or roomId required
   */
  async connected(req: Request, res: Response) {
    logStream("debug", "API calling", "Call Connected");
    const { visitId, roomId, doctorId } = req.body ?? {};

    if (!visitId && !roomId) {
      return res.status(400).json({
        success: false,
        message: "Missing visitId (or roomId, if the call was recorded).",
      });
    }

    const result = await notifyCallConnected({
      visitId,
      roomId,
      doctorId,
      authorization: CallStatusController.authOf(req),
    });

    logStream("debug", `Call Connected -> QMS ${JSON.stringify(result)}`, "Call Connected");
    return res.json({ success: true, qms: result });
  }

  /**
   * POST /api/call/disconnected
   * body: { visitId?, roomId?, doctorId?, reason? }
   *
   * QMS decides the outcome — a live call becomes COMPLETED, a call that never
   * connected returns to the queue — and reports it back in `qms.outcome`.
   */
  async disconnected(req: Request, res: Response) {
    logStream("debug", "API calling", "Call Disconnected");
    const { visitId, roomId, doctorId, reason } = req.body ?? {};

    if (!visitId && !roomId) {
      return res.status(400).json({
        success: false,
        message: "Missing visitId (or roomId, if the call was recorded).",
      });
    }

    const result = await notifyCallDisconnected({
      visitId,
      roomId,
      doctorId,
      reason,
      authorization: CallStatusController.authOf(req),
    });

    logStream("debug", `Call Disconnected -> QMS ${JSON.stringify(result)}`, "Call Disconnected");
    return res.json({ success: true, qms: result });
  }

  /**
   * GET /api/call/qms-status
   * Whether this deployment is wired to QMS at all. No secrets in the response.
   */
  async status(_req: Request, res: Response) {
    return res.json({ success: true, qms: qmsStatus() });
  }
}
