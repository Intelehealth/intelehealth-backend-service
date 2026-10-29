/**
 * call_data.call_status values. Lowercase, matching the values already stored
 * (calling, success, failure). A connected call keeps "success" after it ends normally.
 */
const CALL_DATA_STATUS = {
  CALLING: "calling",
  SUCCESS: "success",
  FAILURE: "failure",
  NO_ANSWER: "no_answer",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
  DISCONNECTED: "disconnected",
  UNKNOWN: "unknown",
};

const S = CALL_DATA_STATUS;

/**
 * Call outcomes and the call_data row they produce. Every reason stored in call_data comes from
 * here, so each one has a single spelling.
 *   phase "connect": participants connected; sets connected_at.
 *   phase "end":     a connected call ended; duration counts from connected_at.
 *   phase "before":  the attempt ended without connecting; duration 0.
 *   phase "issue":   a problem seen while ringing. Stored as the reason without ending the call,
 *                    and becomes the outcome (as a failure) if the attempt then ends in one of
 *                    `replaces` instead of connecting. Higher `rank` wins over a lower one.
 */
const CALL_OUTCOMES = {
  connected: { phase: "connect", status: S.SUCCESS, reason: "Call connected successfully" },

  doctorEnded: { phase: "end", status: S.SUCCESS, reason: "Doctor ended the call" },
  hwEnded: { phase: "end", status: S.SUCCESS, reason: "HW ended the call" },
  endedNormally: { phase: "end", status: S.SUCCESS, reason: "Call ended normally" },
  callDropped: { phase: "end", status: S.DISCONNECTED, reason: "Call dropped unexpectedly" },
  networkLostInCall: { phase: "end", status: S.DISCONNECTED, reason: "Call disconnected due to network loss" },
  doctorDisconnectedInCall: { phase: "end", status: S.DISCONNECTED, reason: "Doctor disconnected unexpectedly" },

  noAnswer: { phase: "before", status: S.NO_ANSWER, reason: "HW not answering" },
  hwRejected: { phase: "before", status: S.REJECTED, reason: "HW rejected the call" },
  doctorCancelled: { phase: "before", status: S.CANCELLED, reason: "Doctor cancelled the call" },
  doctorCancelledImmediately: { phase: "before", status: S.CANCELLED, reason: "Doctor cancelled the call immediately" },
  networkUnavailable: { phase: "before", status: S.FAILURE, reason: "Network unavailable" },
  doctorLeftPage: { phase: "before", status: S.FAILURE, reason: "Doctor left the page" },
  connectionClosed: { phase: "before", status: S.FAILURE, reason: "Connection closed (page closed/reloaded or network lost)" },
  livekitFailed: { phase: "before", status: S.FAILURE, reason: "LiveKit connection failed" },
  initiationApiFailed: { phase: "before", status: S.FAILURE, reason: "Call initiation API failed" },
  unknown: { phase: "before", status: S.UNKNOWN, reason: "Call outcome could not be determined" },

  // No push token, the provider rejected it, or the request failed.
  pushFailed: { phase: "issue", rank: 3, replaces: ["noAnswer", "unknown"], reason: "Push notification delivery failed" },
  hwNotAvailable: { phase: "issue", rank: 2, replaces: ["noAnswer", "unknown"], reason: "HW not available" },
  micDenied: { phase: "issue", rank: 1, replaces: ["doctorCancelled", "doctorCancelledImmediately"], reason: "Doctor microphone permission denied" },
  mediaFailed: { phase: "issue", rank: 1, replaces: ["doctorCancelled", "doctorCancelledImmediately"], reason: "Audio/video connection failed" },
};

// Outcomes the doctor webapp may report itself (call_outcome socket event).
// Before the HW was called there is no row yet, so these create one.
const WEBAPP_PRE_CALL_OUTCOMES = ["networkUnavailable", "livekitFailed", "initiationApiFailed"];
const WEBAPP_CALL_OUTCOMES = ["micDenied", "mediaFailed", "livekitFailed", "networkUnavailable"];

module.exports = {
  CALL_DATA_STATUS,
  CALL_OUTCOMES,
  WEBAPP_PRE_CALL_OUTCOMES,
  WEBAPP_CALL_OUTCOMES,
};
