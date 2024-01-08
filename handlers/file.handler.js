const AWS = require("aws-sdk");
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const {
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_REGION,
  AWS_BUCKET_NAME,
  AWS_URL,
} = process.env;

/**
 * File parser
 * @param {*} req - req object
 * @param {*} res - res object
 * @param {*} next - next object 
 */
const fileParser = async (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (err) res.json({ success: false, message: err.message });
    next();
  });
};

/**
 * Upload file to aws
 * @param {*} data - file
 * @param {string} filepath - file path
 * @param {string} type - file type
 */
const uploadFile = async (data, filePath, type = "image") => {
  AWS.config.update({
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
    region: AWS_REGION,
  });

  const s3 = new AWS.S3();
  let extension = data.originalname.split
    ? data.originalname.split(".")[data.originalname.split(".").length - 1]
    : "jpg";
  if (!extension) extension = "jpg";

  const Key = `${type}_${Date.now()}.${extension}`;
  const params = {
    Bucket: AWS_BUCKET_NAME,
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
    throw err;
  });

  return `${AWS_URL}${Key}`;
};

module.exports = {
  fileParser,
  uploadFile,
};
