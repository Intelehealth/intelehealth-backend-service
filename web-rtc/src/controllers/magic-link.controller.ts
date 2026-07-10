import { Request, Response } from 'express';
import { WebRTCService } from '../services/webrtc.service';
import { encryptMagic, decryptMagic } from '../services/magic-link.service';

export class MagicLinkController {
  async generate(req: Request, res: Response) {
    const { visitUuid, roomId, doctorName, patientName, name, ttlMinutes } =
      req.body || {};

    if (!visitUuid) {
      return res.json({ success: false, message: 'Missing visitUuid.' });
    }

    const room = String(roomId || visitUuid);
    const identity = String(name || `guest-${room}`);
    const token = await new WebRTCService().getToken(room, identity);
    const ttl = Number(ttlMinutes) > 0 ? Number(ttlMinutes) : 60;

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
