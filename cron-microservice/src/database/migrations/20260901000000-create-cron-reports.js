module.exports = {
  id: "20260901000000-create-cron-reports",
  up: async (connection) => connection.query(`CREATE TABLE cron_reports (
    id BIGINT NOT NULL AUTO_INCREMENT,
    report_date DATE NOT NULL,
    timezone VARCHAR(64) NOT NULL,
    period_start DATETIME NOT NULL,
    period_end DATETIME NOT NULL,
    metrics JSON NULL,
    status ENUM('running', 'completed', 'failed') NOT NULL DEFAULT 'running',
    slack_status ENUM('pending', 'sent', 'debug', 'skipped', 'failed') NOT NULL DEFAULT 'pending',
    error TEXT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY cron_reports_report_date_unique (report_date)
  ) ENGINE=InnoDB`),
};
