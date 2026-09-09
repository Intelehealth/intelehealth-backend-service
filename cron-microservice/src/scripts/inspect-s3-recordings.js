require("dotenv").config();

const moment = require("moment-timezone");
const { S3Client, ListObjectsV2Command } = require("@aws-sdk/client-s3");
const {
  countRecordingsByKeyTimestamp,
  listLocationFolders,
  parseKeyTimestamp,
  RECORDING_FILE_PREFIX,
  RECORDING_DATE_FORMAT,
  RECORDING_TIME_FORMAT,
} = require("../crons/services/report-metrics.service");

/*
  Read-only reconnaissance for the recordings bucket: prints the location
  folders, a sample of keys with the timestamp parsed out of each one, and the
  per-day counts the daily report would produce. It only lists objects; it
  never writes, copies, or deletes.
*/
const argument = (name, fallback) => {
  const match = process.argv.find((value) => value.startsWith(`--${name}=`));
  return match ? match.slice(name.length + 3) : fallback;
};

const bucket = argument("bucket", process.env.WEBRTC_RECORDINGS_S3_BUCKET);
const prefix = argument("prefix", process.env.WEBRTC_RECORDINGS_S3_PREFIX || "");
const timezone = argument("timezone", process.env.CRON_TIMEZONE || "UTC");
const days = Number(argument("days", "7"));
const samples = Number(argument("samples", "5"));
const keyFormat = `${RECORDING_DATE_FORMAT}_${RECORDING_TIME_FORMAT}`;

const sampleKeys = async (client, folder) => {
  const response = await client.send(new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: folder,
    MaxKeys: samples,
  }));
  return (response.Contents || []).map(({ Key, Size, LastModified }) => ({ Key, Size, LastModified }));
};

const describeKey = ({ Key, Size, LastModified }) => {
  const recordedAt = parseKeyTimestamp(Key, {
    filePrefix: RECORDING_FILE_PREFIX,
    keyFormat,
    timezone,
  });
  const parsed = recordedAt ? recordedAt.format("YYYY-MM-DD HH:mm:ss") : "UNPARSED";
  const uploaded = LastModified ? moment(LastModified).tz(timezone).format("YYYY-MM-DD HH:mm:ss") : "-";
  return `    ${Key}\n      key time: ${parsed}   uploaded: ${uploaded}   size: ${Size ?? "-"}`;
};

const inspect = async () => {
  if (!bucket) throw new Error("Set WEBRTC_RECORDINGS_S3_BUCKET or pass --bucket=<name>");
  if (!moment.tz.zone(timezone)) throw new Error(`Invalid timezone: ${timezone}`);
  if (!Number.isInteger(days) || days <= 0) throw new Error("--days must be a positive integer");

  const client = new S3Client({ region: process.env.AWS_REGION });
  const base = !prefix || prefix.endsWith("/") ? prefix : `${prefix}/`;

  console.info(`Bucket:   ${bucket}`);
  console.info(`Prefix:   ${base || "(bucket root)"}`);
  console.info(`Timezone: ${timezone}`);
  console.info(`Expected key shape: <prefix><location>/${RECORDING_FILE_PREFIX}${keyFormat}.mp4`);

  const folders = await listLocationFolders({ client, bucket, prefix: base });
  console.info(`\nLocation folders (${folders.length}):`);
  if (!folders.length) console.info("  none — objects sit directly under the prefix");
  for (const folder of folders) console.info(`  ${folder.slice(base.length).replace(/\/$/, "")}`);

  console.info("\nSample keys:");
  for (const folder of folders.length ? folders : [base]) {
    const keys = await sampleKeys(client, folder);
    console.info(`  ${folder}`);
    if (!keys.length) console.info("    (empty)");
    for (const key of keys) console.info(describeKey(key));
  }

  console.info("\nPer-day counts (date, total, per-location):");
  const today = moment.tz(timezone).startOf("day");
  for (let offset = 0; offset < days; offset += 1) {
    const start = today.clone().subtract(offset, "days");
    const end = start.clone().add(1, "day");
    const { count, breakdown } = await countRecordingsByKeyTimestamp({
      client,
      bucket,
      prefix: base,
      start: start.toDate(),
      end: end.toDate(),
      timezone,
    });
    const locations = Object.entries(breakdown)
      .sort(([, left], [, right]) => right - left)
      .map(([location, total]) => `${location}=${total}`)
      .join(", ");
    console.info(`  ${start.format("YYYY-MM-DD")}  ${String(count).padStart(5)}  ${locations || "-"}`);
  }
};

inspect().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
