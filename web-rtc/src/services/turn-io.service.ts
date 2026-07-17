import axios from 'axios';

const TURN_API_URL =
  process.env.TURN_API_URL || 'https://whatsapp.turn.io/v1/messages';

export const normalizeNumber = (n?: string | null): string =>
  String(n || '').replace(/\D/g, '');

const isDryRun = () => process.env.TURN_DRY_RUN === 'true';

const postMessage = async (payload: any) => {
  if (isDryRun()) {
    console.log('[turn-io] DRY RUN, not sending:', JSON.stringify(payload));
    return;
  }
  await axios.post(TURN_API_URL, payload, {
    headers: {
      Authorization: `Bearer ${process.env.TURN_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });
};

export interface AppointmentCallLinkMessage {
  number: string;
  joinUrl: string;
  patientName?: string | null;
  doctorName?: string | null;
  slotTime?: string | null;
}

const buildTemplatePayload = (to: string, msg: AppointmentCallLinkMessage) => ({
  to,
  type: 'template',
  template: {
    namespace: process.env.TURN_APPOINTMENT_TEMPLATE_NAMESPACE || undefined,
    name: process.env.TURN_APPOINTMENT_TEMPLATE_NAME,
    language: {
      policy: 'deterministic',
      code: process.env.TURN_APPOINTMENT_TEMPLATE_LANG || 'en',
    },
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: msg.patientName || 'there' },
          { type: 'text', text: msg.slotTime || 'shortly' },
          { type: 'text', text: msg.joinUrl },
        ],
      },
    ],
  },
});

const buildTextPayload = (to: string, msg: AppointmentCallLinkMessage) => {
  const greeting = msg.patientName ? `Hello ${msg.patientName}, ` : '';
  const doctor = msg.doctorName ? ` with Dr. ${msg.doctorName}` : '';
  const when = msg.slotTime ? ` at ${msg.slotTime}` : ' shortly';
  return {
    to,
    type: 'text',
    text: {
      body: `${greeting}your video consultation${doctor} starts${when}. Tap the link below to join:\n\n${msg.joinUrl}`,
    },
  };
};

export async function sendAppointmentCallLink(
  msg: AppointmentCallLinkMessage
): Promise<void> {
  if (!process.env.TURN_API_TOKEN && !isDryRun()) {
    throw new Error('TURN_API_TOKEN is not set');
  }

  const to = normalizeNumber(msg.number);
  if (!to) {
    throw new Error('recipient number is required');
  }

  const payload = process.env.TURN_APPOINTMENT_TEMPLATE_NAME
    ? buildTemplatePayload(to, msg)
    : buildTextPayload(to, msg);

  await postMessage(payload);
}
