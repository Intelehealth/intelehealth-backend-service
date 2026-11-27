import { QueryInterface, QueryTypes, Transaction } from "sequelize";

const ACTIVITY_TYPE = "AI LLM VOICE TRANSCRIPT CONFIG UPDATED";

async function getEnumValues(queryInterface: QueryInterface, transaction: Transaction): Promise<string[]> {
  const rows = await queryInterface.sequelize.query<{ COLUMN_TYPE: string }>(
    "SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'audit_trail' AND COLUMN_NAME = 'activity_type'",
    { type: QueryTypes.SELECT, transaction }
  );
  const columnType = rows[0].COLUMN_TYPE;
  return columnType
    .slice(columnType.indexOf("(") + 1, columnType.lastIndexOf(")"))
    .split(",")
    .map((value) => value.trim().replace(/^'|'$/g, "").replace(/''/g, "'"));
}

async function setEnumValues(queryInterface: QueryInterface, transaction: Transaction, values: string[]): Promise<void> {
  const enumSql = values.map((value) => queryInterface.sequelize.escape(value)).join(",");
  await queryInterface.sequelize.query(
    `ALTER TABLE audit_trail MODIFY COLUMN activity_type ENUM(${enumSql}) NOT NULL`,
    { transaction }
  );
}

/** @type {import("sequelize-cli").Migration} */
module.exports = {
  up: (queryInterface: QueryInterface): Promise<void> =>
    queryInterface.sequelize.transaction(async (transaction) => {
      const values = await getEnumValues(queryInterface, transaction);
      if (!values.includes(ACTIVITY_TYPE)) {
        await setEnumValues(queryInterface, transaction, [...values, ACTIVITY_TYPE]);
      }
    }),

  down: (queryInterface: QueryInterface): Promise<void> =>
    queryInterface.sequelize.transaction(async (transaction) => {
      const values = await getEnumValues(queryInterface, transaction);
      if (values.includes(ACTIVITY_TYPE)) {
        await queryInterface.bulkDelete("audit_trail", { activity_type: ACTIVITY_TYPE }, { transaction });
        await setEnumValues(queryInterface, transaction, values.filter((value) => value !== ACTIVITY_TYPE));
      }
    }),
};
