const db = require('../models');

const affectedRows = (result: any): number => {
  const a = result?.[0]?.affectedRows;
  const b = result?.[1]?.affectedRows;
  return Math.max(Number.isFinite(a) ? a : 0, Number.isFinite(b) ? b : 0);
};

export async function claim(
  appointmentId: string,
  staleMinutes: number,
  maxAttempts: number
): Promise<boolean> {
  const reclaimed = await db.sequelize.query(
    `UPDATE turn_call_links
        SET status = 'sending', attempts = attempts + 1, updatedAt = NOW()
      WHERE appointmentId = :id
        AND attempts < :maxAttempts
        AND (status = 'failed'
             OR (status = 'sending'
                 AND updatedAt < DATE_SUB(NOW(), INTERVAL :staleMinutes MINUTE)))`,
    { replacements: { id: appointmentId, staleMinutes, maxAttempts } }
  );

  if (affectedRows(reclaimed) === 1) {
    return true;
  }

  const created = await db.sequelize.query(
    `INSERT IGNORE INTO turn_call_links
       (appointmentId, status, attempts, createdAt, updatedAt)
     VALUES (:id, 'sending', 1, NOW(), NOW())`,
    { replacements: { id: appointmentId } }
  );

  return affectedRows(created) === 1;
}

export async function markSent(appointmentId: string): Promise<void> {
  await db.sequelize.query(
    `UPDATE turn_call_links
        SET status = 'sent', sentAt = NOW(), lastError = NULL, updatedAt = NOW()
      WHERE appointmentId = :id`,
    { replacements: { id: appointmentId } }
  );
}

export async function markFailed(
  appointmentId: string,
  error: string
): Promise<void> {
  await db.sequelize.query(
    `UPDATE turn_call_links
        SET status = 'failed', lastError = :error, updatedAt = NOW()
      WHERE appointmentId = :id`,
    { replacements: { id: appointmentId, error: String(error).slice(0, 500) } }
  );
}
