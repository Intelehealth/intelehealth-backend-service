import cron from 'node-cron';
import moment from 'moment';
import { AppointmentRow, findDueForCallLink } from '../services/appointment.repository';
import { claim, markFailed, markSent } from '../services/turn-call-link.repository';
import { signShortCode } from '../services/magic-link.service';
import { getPatientContact } from '../services/openmrs.service';
import { sendAppointmentCallLink } from '../services/turn-io.service';

const SQL_DATE_FORMAT = 'YYYY-MM-DD HH:mm:ss';

const num = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const leadMinutes = () => num(process.env.TURN_CALL_LINK_LEAD_MINUTES, 15);
const graceMinutes = () => num(process.env.TURN_CALL_LINK_GRACE_MINUTES, 10);
const staleMinutes = () => num(process.env.TURN_CALL_LINK_STALE_MINUTES, 5);
const maxAttempts = () => num(process.env.TURN_CALL_LINK_MAX_ATTEMPTS, 3);

const publicBase = () => (process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, '');

let running = false;

type Outcome = 'sent' | 'skipped' | 'failed';

const dispatch = async (row: AppointmentRow): Promise<Outcome> => {
  const id = String(row.id);

  if (!(await claim(id, staleMinutes(), maxAttempts()))) {
    return 'skipped';
  }

  try {
    const { phone, name } = await getPatientContact(row.patientId);

    if (!phone) {
      await markFailed(id, 'no phone number on patient record');
      console.warn(
        `[turn-call-link] appointment ${id}: no phone number for patient ${row.patientId}`
      );
      return 'failed';
    }

    await sendAppointmentCallLink({
      number: phone,
      joinUrl: `${publicBase()}/api/magic-link/j/${signShortCode(id)}`,
      patientName: row.patientName || name,
      doctorName: row.drName,
      slotTime: row.slotTime,
    });

    await markSent(id);
    console.log(
      `[turn-call-link] appointment ${id}: sent call link to patient ${row.patientId}`
    );
    return 'sent';
  } catch (err: any) {
    const reason = err?.response?.data
      ? JSON.stringify(err.response.data)
      : err?.message || String(err);
    await markFailed(id, reason);
    console.error(`[turn-call-link] appointment ${id}: send failed:`, reason);
    return 'failed';
  }
};

export const tick = async (): Promise<void> => {
  if (running) return;
  running = true;

  try {
    const from = moment.utc().subtract(graceMinutes(), 'minutes').format(SQL_DATE_FORMAT);
    const to = moment.utc().add(leadMinutes(), 'minutes').format(SQL_DATE_FORMAT);

    const rows = await findDueForCallLink(from, to);
    if (!rows.length) return;

    const counts: Record<Outcome, number> = { sent: 0, skipped: 0, failed: 0 };

    for (const row of rows) {
      try {
        counts[await dispatch(row)]++;
      } catch (err: any) {
        counts.failed++;
        console.error(
          `[turn-call-link] appointment ${row.id}: dispatch error:`,
          err?.message || err
        );
      }
    }

    if (counts.sent || counts.failed) {
      console.log(
        `[turn-call-link] discovered=${rows.length} sent=${counts.sent} failed=${counts.failed} skipped=${counts.skipped}`
      );
    }
  } catch (err: any) {
    console.error('[turn-call-link] tick failed:', err?.message || err);
  } finally {
    running = false;
  }
};

export function startAppointmentCallLinkJob(): void {
  if (process.env.IS_TURN_SERVER !== 'true') return;
  if (process.env.TURN_CALL_LINK_ENABLED !== 'true') return;

  if (!publicBase()) {
    console.error(
      '[turn-call-link] PUBLIC_BASE_URL is not set, job not started (patients would receive an unreachable link)'
    );
    return;
  }

  const expression = process.env.TURN_CALL_LINK_CRON || '*/1 * * * *';
  if (!cron.validate(expression)) {
    console.error(`[turn-call-link] invalid TURN_CALL_LINK_CRON "${expression}", job not started`);
    return;
  }

  cron.schedule(expression, tick, { scheduled: true });

  console.log(
    `[turn-call-link] started: cron="${expression}" lead=${leadMinutes()}m grace=${graceMinutes()}m ` +
      `maxAttempts=${maxAttempts()} dryRun=${process.env.TURN_DRY_RUN === 'true'}`
  );
}
