const db = require('../models');

export function slotStartMillis(slotJsDate: unknown): number {
  if (slotJsDate instanceof Date) {
    return slotJsDate.getTime();
  }

  const raw = String(slotJsDate ?? '').trim();
  if (!raw) return NaN;

  const iso = raw.includes('T') ? raw : raw.replace(' ', 'T');
  const hasZone = /[Zz]$/.test(iso) || /[+-]\d{2}:?\d{2}$/.test(iso);

  return new Date(hasZone ? iso : `${iso}Z`).getTime();
}

export interface AppointmentRow {
  id: number;
  slotJsDate: Date | string;
  slotDate: string;
  slotTime: string;
  userUuid: string;
  drName: string;
  visitUuid: string;
  patientId: string;
  patientName: string;
  openMrsId: string;
  status: string;
}

const SELECT_FIELDS = `id, slotJsDate, slotDate, slotTime, userUuid, drName,
  visitUuid, patientId, patientName, openMrsId, status`;

export async function findDueForCallLink(
  fromUtc: string,
  toUtc: string
): Promise<AppointmentRow[]> {
  const rows = await db.sequelize.query(
    `SELECT ${SELECT_FIELDS}
     FROM appointments
     WHERE status = 'booked'
       AND patientId IS NOT NULL
       AND patientId <> ''
       AND slotJsDate BETWEEN :fromUtc AND :toUtc
     ORDER BY slotJsDate ASC`,
    {
      replacements: { fromUtc, toUtc },
      type: db.Sequelize.QueryTypes.SELECT,
    }
  );
  return rows as AppointmentRow[];
}

export async function findById(id: string): Promise<AppointmentRow | null> {
  const rows = await db.sequelize.query(
    `SELECT ${SELECT_FIELDS} FROM appointments WHERE id = :id LIMIT 1`,
    { replacements: { id }, type: db.Sequelize.QueryTypes.SELECT }
  );
  const list = rows as AppointmentRow[];
  return list.length ? list[0] : null;
}
