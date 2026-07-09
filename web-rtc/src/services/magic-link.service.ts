import * as crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer {
  const secret =
    process.env.MAGIC_LINK_SECRET ||
    process.env.SECRET ||
    'intelehealth-magic-link-dev-secret';
  return crypto.createHash('sha256').update(String(secret)).digest();
}

export interface MagicPayload {
  v: number;
  visitUuid: string;
  roomId: string;
  token: string;
  doctorName?: string;
  patientName?: string;
  exp: number;
}

export function encryptMagic(payload: MagicPayload): string {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const data = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, data]).toString('base64url');
}

export function decryptMagic(token: string): MagicPayload | null {
  try {
    const buf = Buffer.from(token, 'base64url');
    if (buf.length < IV_LEN + TAG_LEN + 1) return null;
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const data = buf.subarray(IV_LEN + TAG_LEN);
    const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
    decipher.setAuthTag(tag);
    const out = Buffer.concat([decipher.update(data), decipher.final()]);
    return JSON.parse(out.toString('utf8')) as MagicPayload;
  } catch {
    return null;
  }
}
