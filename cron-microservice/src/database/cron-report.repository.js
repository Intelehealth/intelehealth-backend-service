const { database } = require("./index");

class CronReportRecord {
  constructor(values, connection = database) {
    Object.assign(this, values);
    this.connection = connection;
  }

  async update(values) {
    const entries = Object.entries(values);
    if (!entries.length) return this;
    const assignments = entries.map(([column]) => `\`${column}\` = :${column}`).join(", ");
    const replacements = { id: this.id, updated_at: new Date() };
    for (const [column, value] of entries) {
      replacements[column] = ["metrics"].includes(column) && value != null
        ? JSON.stringify(value)
        : value;
    }
    await this.connection.query(
      `UPDATE cron_reports SET ${assignments}, updated_at = :updated_at WHERE id = :id`,
      replacements
    );
    Object.assign(this, values, { updated_at: replacements.updated_at });
    return this;
  }
}

class CronReportRepository {
  constructor(connection = database) {
    this.connection = connection;
  }

  async findOrCreate({ reportDate, timezone, periodStart, periodEnd }) {
    const now = new Date();
    const [result] = await this.connection.query(
      `INSERT IGNORE INTO cron_reports
        (report_date, timezone, period_start, period_end, status, slack_status, created_at, updated_at)
       VALUES (:reportDate, :timezone, :periodStart, :periodEnd, 'running', 'pending', :now, :now)`,
      { reportDate, timezone, periodStart, periodEnd, now }
    );
    const [rows] = await this.connection.query(
      "SELECT * FROM cron_reports WHERE report_date = :reportDate LIMIT 1",
      { reportDate }
    );
    return [new CronReportRecord(rows[0], this.connection), result.affectedRows === 1];
  }
}

module.exports = { CronReportRepository, CronReportRecord };
