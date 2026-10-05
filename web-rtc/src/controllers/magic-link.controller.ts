import { Request, Response } from 'express';
import { WebRTCService } from '../services/webrtc.service';
import {
  encryptMagic,
  decryptMagic,
  verifyShortCode,
} from '../services/magic-link.service';
import { findById, slotStartMillis } from '../services/appointment.repository';

const notice = (title: string, detail: string) => `<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title></head>
<body style="font-family:system-ui,-apple-system,sans-serif;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;background:#f5f7fa;color:#1f2933">
<div style="max-width:22rem;padding:2rem;text-align:center">
<h1 style="font-size:1.25rem;margin:0 0 .5rem">${title}</h1>
<p style="margin:0;color:#616e7c;line-height:1.5">${detail}</p>
</div></body></html>`;

export class MagicLinkController {
  async generate(req: Request, res: Response) {
    const { visitUuid, roomId, doctorName, patientName, name, ttlMinutes } =
      req.body || {};

    if (!visitUuid) {
      return res.json({ success: false, message: 'Missing visitUuid.' });
    }

    const room = String(roomId || visitUuid);
    const identity = String(name || `guest-${room}`);
    const ttl = Number(ttlMinutes) > 0 ? Number(ttlMinutes) : 60;
    const token = await new WebRTCService().getGuestToken(room, identity, ttl * 60);

    const magicToken = encryptMagic({
      v: 1,
      visitUuid: String(visitUuid),
      roomId: room,
      token,
      doctorName: doctorName ? String(doctorName) : undefined,
      patientName: patientName ? String(patientName) : undefined,
      exp: Date.now() + ttl * 60 * 1000,
    });

    const rawBase = process.env.HW_WEBAPP_URL || 'http://localhost:3002/';
    const base = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
    const url = `${base}#/join/${magicToken}`;

    return res.json({ success: true, magicToken, url });
  }

  async joinShort(req: Request, res: Response) {
    try {
      return await joinShortInner(req, res);
    } catch (err: any) {
      console.error('[magic-link] joinShort failed:', err?.message || err);
      return res
        .status(500)
        .send(
          notice(
            'Something went wrong',
            'We could not open this call right now. Please try again, or contact your health provider.'
          )
        );
    }
  }

  async roomStatus(req: Request, res: Response) {
    const room = String(req.query.room || req.query.roomId || '');
    if (!room) {
      return res.json({ success: false, message: 'Missing room.' });
    }

    const participants = await new WebRTCService().listParticipants(room);
    const list = (participants || []).map((p: any) => ({
      identity: String(p.identity || ''),
      name: String(p.name || ''),
    }));
    const doctorPresent = list.some(
      (p: { identity: string }) => p.identity && !p.identity.startsWith('guest-')
    );

    return res.json({
      success: true,
      room,
      participantCount: list.length,
      doctorPresent,
      participants: list,
    });
  }

  async redeem(req: Request, res: Response) {
    const m = (req.query.m as string) || '';
    if (!m) {
      return res
        .status(400)
        .json({ success: false, message: 'Missing magic token.' });
    }

    const payload = decryptMagic(m);
    if (!payload) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid or corrupt link.' });
    }
    if (!payload.exp || payload.exp < Date.now()) {
      return res
        .status(410)
        .json({ success: false, message: 'This link has expired.' });
    }

    return res.json({
      success: true,
      roomId: payload.roomId,
      token: payload.token,
      visitUuid: payload.visitUuid,
      doctorName: payload.doctorName,
      patientName: payload.patientName,
    });
  }
}

async function joinShortInner(req: Request, res: Response) {
    const appointmentId = verifyShortCode(String(req.params.code || ''));
    if (!appointmentId) {
      return res
        .status(400)
        .send(notice('Invalid link', 'This joining link is not valid. Please contact your health provider.'));
    }

    const appointment = await findById(appointmentId);
    if (!appointment) {
      return res
        .status(404)
        .send(notice('Appointment not found', 'We could not find this appointment.'));
    }

    if (String(appointment.status).toLowerCase() !== 'booked') {
      return res
        .status(410)
        .send(
          notice(
            'Appointment no longer scheduled',
            'This appointment was cancelled or rescheduled. Please contact your health provider.'
          )
        );
    }

    const room = String(appointment.patientId || '');
    if (!room) {
      return res
        .status(409)
        .send(notice('Call not available', 'This appointment is not ready for a video call.'));
    }

    const openBefore = Number(process.env.TURN_CALL_LINK_OPEN_BEFORE_MINUTES) || 30;
    const openAfter = Number(process.env.TURN_CALL_LINK_OPEN_AFTER_MINUTES) || 120;
    const startsAt = slotStartMillis(appointment.slotJsDate);

    if (!Number.isFinite(startsAt)) {
      console.error(
        `[magic-link] appointment ${appointmentId}: unparseable slotJsDate`,
        appointment.slotJsDate
      );
      return res
        .status(500)
        .send(notice('Something went wrong', 'We could not open this call. Please contact your health provider.'));
    }

    const now = Date.now();
    if (now < startsAt - openBefore * 60 * 1000) {
      return res
        .status(425)
        .send(
          notice(
            'Not open yet',
            'Your video consultation is not open yet. Please use this link closer to your appointment time.'
          )
        );
    }
    if (now > startsAt + openAfter * 60 * 1000) {
      return res
        .status(410)
        .send(notice('Link expired', 'This joining link has expired. Please contact your health provider.'));
    }

    const ttl = Number(process.env.TURN_CALL_LINK_TTL_MINUTES) || 120;
    const token = await new WebRTCService().getGuestToken(room, `guest-${room}`, ttl * 60);

    const magicToken = encryptMagic({
      v: 1,
      visitUuid: String(appointment.visitUuid || ''),
      roomId: room,
      token,
      doctorName: appointment.drName ? String(appointment.drName) : undefined,
      patientName: appointment.patientName ? String(appointment.patientName) : undefined,
      exp: Date.now() + ttl * 60 * 1000,
    });

    const rawBase = process.env.HW_WEBAPP_URL || 'http://localhost:3002/';
    const base = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;

    return res.redirect(302, `${base}#/join/${magicToken}`);
}
