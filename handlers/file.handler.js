const AWS = require("aws-sdk");
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const env = process.env.NODE_ENV || "development";
const config =  process.env;

const fileParser = async (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (err) res.json({ success: false, message: err.message });
    next();
  });
};

const uploadFile = async (data, filePath, type = "image") => {
  AWS.config.update({
    accessKeyId: config.AWS_ACCESS_KEY_ID,
    secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
    region: config.AWS_REGION,
  });

  const s3 = new AWS.S3();
  let extension = data.originalname.split
    ? data.originalname.split(".")[data.originalname.split(".").length - 1]
    : "jpg";
  if (!extension) extension = "jpg";

  console.log("extension: ", extension);
  // const Key = `${filePath}/${type}_${Date.now()}.${extension}`;
  const Key = `${type}_${Date.now()}.${extension}`;
  const params = {
    Bucket: config.AWS_BUCKET_NAME,
    Key,
    Body: data.buffer,
    ACL: "public-read",
  };

  await new Promise((res, rej) => {
    s3.putObject(params, function (err, data) {
      if (err) rej(err);
      res(data);
    });
  }).catch((err) => {
    console.log("err: ", err);
    throw err;
  });

  return `${config.AWS_URL}${Key}`;
};

module.exports = {
  fileParser,
  uploadFile,
};
