const { format, createLogger, transports } = require("winston");
const { combine, timestamp, label, printf, prettyPrint } = format;
require("winston-daily-rotate-file");

const CATEGORY = 'LOG';

//DailyRotateFile func()
const fileRotateTransport = new transports.DailyRotateFile({
  filename: "logs/rotate-%DATE%.log",
  datePattern: "YYYY-MM-DD",
  maxFiles: "14d",
});

const customFormat = printf(({ 
  level, 
  message, 
  label, 
  timestamp 
}) => {
  return `${timestamp} [${label}] ${level}: ${message}`;
});

const logger =createLogger({
  level: "debug",
  format: combine(
    label({ label: CATEGORY }),
    timestamp({
      format: "MMM-DD-YYYY HH:mm:ss",
    }),
    customFormat
  ),
  transports: [
    fileRotateTransport,
    new transports.File({
      filename: "logs/error.log",
    })
  ],
});

exports.logStream = (type, data, prefix) => {
  switch(type) {
    case 'info':
      logger.log("info", data)
    break
    case 'debug':
      logger.log("debug", `${prefix}---${JSON.stringify(data)}`)
    break
    case 'error':
      logger.log("error", data)
    break
  }
}