const test = require("node:test");
const assert = require("node:assert/strict");

const { STATUS } = require("../src/constants");
const { toListItem } = require("../src/services/queue.service");

/**
 * connectedAt — when the call connected, stamped the same way assignedAt
 * is. It was already in statusPayload but missing from toListItem, so a
 * client reading /list for a CALL_CONNECTED case (the HW app's "on call"
 * screen) had no timestamp to show a call duration from.
 */

test("toListItem carries connectedAt, like it does assignedAt", () => {
  const connectedAt = new Date();
  const entry = {
    id: 1,
    status: STATUS.CALL_CONNECTED,
    connectedAt,
    assignedAt: null,
    queuedAt: null,
    completedAt: null,
    escalatedAt: null,
    lastHeartbeatAt: null,
    callEndedAt: null,
  };
  const item = toListItem(entry);
  assert.equal(item.connectedAt, connectedAt);
});

test("it is null before the call connects, not omitted", () => {
  const entry = {
    id: 1,
    status: STATUS.ASSIGNED,
    connectedAt: null,
    assignedAt: new Date(),
    queuedAt: null,
    completedAt: null,
    escalatedAt: null,
    lastHeartbeatAt: null,
    callEndedAt: null,
  };
  const item = toListItem(entry);
  assert.ok(Object.prototype.hasOwnProperty.call(item, "connectedAt"));
  assert.equal(item.connectedAt, null);
});
