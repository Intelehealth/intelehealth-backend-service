module.exports = {
  apps: [
    {
      name: "Mindmap",
      script: "./bin/www",
      error_file: "./err.log",
      out_log: "./out.log",
      log_date_format: "YYYY-MM-DD HH:mm Z",
    },
    {
      name: "NOTIFICATION_CRON_MINDMAP",
      script: "./cronServer.js",
      error_file: "./cron_err.log",
      out_log: "./cron_out.log",
      log_date_format: "YYYY-MM-DD HH:mm Z",
    },
  ],
};
