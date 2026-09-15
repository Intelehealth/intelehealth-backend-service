"use strict";

/**
 * Renames four statuses to the agreed case lifecycle.
 *
 *   CONNECTING           -> CALL_CONNECTING
 *   CONNECTED            -> CALL_CONNECTED
 *   PRESCRIPTION_PENDING -> CALL_COMPLETED
 *   COMPLETED            -> PRESCRIPTION_COMPLETED
 *
 * The names now say which thing finished. "COMPLETED" was the ambiguity worth
 * removing: it read as "the visit is over" while only ever meaning "the call
 * is over", which is exactly the confusion this lifecycle exists to settle.
 *
 * Done in three steps rather than one MODIFY. MySQL rewrites an ENUM column by
 * mapping each row's current value into the new definition, so narrowing and
 * remapping at once would drop every row whose value is no longer listed.
 * Widening first means both spellings are briefly legal, the UPDATEs can move
 * rows across, and the final narrow only removes values nothing holds.
 *
 * The two remaps also cross: PRESCRIPTION_PENDING becomes CALL_COMPLETED while
 * COMPLETED becomes PRESCRIPTION_COMPLETED. In the widened enum they cannot
 * collide, because no row is ever written to a value another row is about to
 * move out of.
 */

const OLD = [
  "SUBMITTED",
  "QUEUED",
  "ESCALATED",
  "ASSIGNED",
  "CONNECTING",
  "CONNECTED",
  "PRESCRIPTION_PENDING",
  "COMPLETED",
  "CANCELLED",
  "RE_QUEUED",
];

const NEW = [
  "SUBMITTED",
  "QUEUED",
  "ESCALATED",
  "ASSIGNED",
  "CALL_CONNECTING",
  "CALL_CONNECTED",
  "CALL_COMPLETED",
  "PRESCRIPTION_COMPLETED",
  "CANCELLED",
  "RE_QUEUED",
];

const RENAMES = [
  ["CONNECTING", "CALL_CONNECTING"],
  ["CONNECTED", "CALL_CONNECTED"],
  ["PRESCRIPTION_PENDING", "CALL_COMPLETED"],
  ["COMPLETED", "PRESCRIPTION_COMPLETED"],
];

const enumSql = (values) =>
  `ENUM(${values.map((v) => `'${v}'`).join(", ")}) NOT NULL DEFAULT 'SUBMITTED'`;

const setStatusColumn = (queryInterface, values) =>
  queryInterface.sequelize.query(
    `ALTER TABLE queue_entries MODIFY COLUMN status ${enumSql(values)}`
  );

const remap = async (queryInterface, pairs) => {
  for (const [from, to] of pairs) {
    const [, meta] = await queryInterface.sequelize.query(
      "UPDATE queue_entries SET status = ? WHERE status = ?",
      { replacements: [to, from] }
    );
    if (meta && meta.affectedRows) {
      // eslint-disable-next-line no-console
      console.log(`  ${from} -> ${to}: ${meta.affectedRows} row(s)`);
    }
  }
};

module.exports = {
  async up(queryInterface) {
    const both = [...new Set([...OLD, ...NEW])];
    await setStatusColumn(queryInterface, both);
    await remap(queryInterface, RENAMES);
    await setStatusColumn(queryInterface, NEW);
  },

  async down(queryInterface) {
    const both = [...new Set([...OLD, ...NEW])];
    await setStatusColumn(queryInterface, both);
    await remap(
      queryInterface,
      RENAMES.map(([from, to]) => [to, from])
    );
    await setStatusColumn(queryInterface, OLD);
  },
};
