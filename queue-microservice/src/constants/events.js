/**
 * Notification event names — backend LLD §10.
 *
 * The LLD specifies these as Socket.io events. This service has no socket
 * server, so the same names travel as the `event` field of an FCM data payload
 * (and of the optional relay webhook). Keeping the names identical means the
 * Android and Angular clients switch on the same strings either way.
 *
 * Extracted into its own module so the message builder and the notification
 * service can both use them without a circular import.
 */
const EVENT = {
  // To the health worker, once, when the visit joins the queue.
  QUEUED: "queue:queued",
  POSITION: "queue:position",
  EWT: "queue:ewt",
  READY: "queue:ready",
  ESCALATED: "queue:escalated",
  CANCELLED: "queue:cancelled",
  // To every doctor in the speciality, once, when a visit joins their queue.
  NEW_CASE: "queue:new_case",
  DOCTOR_QUEUE_UPDATE: "doctor:queue_update",
};

module.exports = { EVENT };
