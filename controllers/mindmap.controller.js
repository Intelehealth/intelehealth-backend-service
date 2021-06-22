const { RES, generateHash } = require("../handlers/helper");
const { mindmaps, licences, links } = require("../models");
const { mkDir } = require("../public/javascripts/directory");
const { rmDir } = require("../public/javascripts/deletefile");
const { wrMindmap } = require("../public/javascripts/writefile");
const { zipFolder } = require("../public/javascripts/zip");
const { getFormattedUrl } = require("../public/javascripts/functions");
const request = require("request");

/**
 * Return mindmaps respect to key
 * @param {request} req
 * @param {response} res
 */
const getMindmapDetails = async (req, res) => {
  const key = req.params.key;
  if (!key)
    RES(res, {
      message: "Please enter a licence key",
    });

  RES(res, {
    data: await mindmaps.findAll({
      where: {
        keyName: key,
      },
      raw: true,
    }),
  });
};

/**
 * Add/Update licence key
 * @param {request} req
 * @param {response} res
 */
const addUpdateLicenceKey = async (req, res) => {
  const body = req.body;
  let message = "";
  let dataToUpdate;
  try {
    let data = await licences.findOne({
      where: { keyName: body.key },
    });
    if (body.type === "image") {
      dataToUpdate = {
        imageName: body.imageName,
        imageValue: body.imageValue,
      };
    } else {
      dataToUpdate = {
        keyName: body.key,
        expiry: body.expiryDate,
      };
    }
    if (data) {
      data = await data.update(dataToUpdate);
      message =
        body.type === "image" ? "Image updated" : "Updated successfully!";
    } else {
      data = await licences.create(dataToUpdate);
      message =
        body.type === "image" ? "Image uploaded" : "Added successfully!";
    }
    RES(res, { data, success: true, message });
  } catch (error) {
    RES(res, { message: error.message, success: false }, 422);
  }
};

/**
 * Return all mindmaps keys
 * @param {request} req
 * @param {response} res
 */
const getMindmapKeys = async (req, res) => {
  RES(res, {
    data: await licences.findAll({
      attributes: ["keyName", "expiry", "imageValue", "imageName"],
    }),
    success: true,
  });
};

/**
 * Add/Update mindmap
 * @param {request} req
 * @param {response} res
 */
const addUpdateMindMap = async (req, res) => {
  const body = req.body;
  let message = "";
  try {
    let data = await mindmaps.findOne({
      where: { keyName: body.key, name: body.filename },
    });
    let dataToUpdate = {
      name: body.filename,
      json: body.value,
      keyName: body.key,
    };
    if (data) {
      data = await data.update(dataToUpdate);
      message = "Mindmap updated successfully!";
    } else {
      data = await mindmaps.create(dataToUpdate);
      message = "Mindmap added successfully!";
    }
    RES(res, { data, success: true, message });
  } catch (error) {
    RES(res, { message: error.message, success: false }, 422);
  }
};

/**
 * Delete mindmap key
 * @param {request} req
 * @param {response} res
 */
const deleteMindmapKey = async (req, res) => {
  const key = req.params.key;
  const mindmapName = req.body.mindmapName;
  try {
    if (!key) {
      RES(res, {
        message: "Please enter a mindmap key",
        success: false,
      });
      return;
    }
    if (!mindmapName) {
      RES(res, {
        message: "Please pass a mindmapName",
        success: false,
      });
      return;
    }

    const data = mindmaps.destroy({
      where: {
        keyName: key,
        name: mindmapName,
      },
    });

    RES(res, {
      data,
      success: true,
      message: "Mindmap deleted successfully!",
    });
  } catch (error) {
    RES(res, { message: error.message, success: false }, 422);
  }
};

/**
 * Download mindmap zip
 * @param {request} req
 * @param {response} res
 */
const downloadMindmaps = async (req, res) => {
  const key = req.query.key;
  try {
    if (!key) {
      RES(res, {
        message: "Please pass a licence key",
        success: false,
      });
      return;
    }

    const licenceData = await licences.findOne({
      where: {
        keyName: key,
      },
      raw: true,
    });

    if (!licenceData) {
      RES(res, {
        message: "Licence key didn't found in the database",
        success: false,
      });
      return;
    }
    const expiryDate = new Date(licenceData.expiry).getTime();
    const currentDate = new Date().getTime();
    if (expiryDate > currentDate) {
      mkDir("./public/key");
      mkDir("./public/key/Engines");
      mkDir("./public/key/logo");
      const mindmapsData = await mindmaps.findAll({
        where: {
          keyName: key,
        },
        raw: true,
      });

      for (let i = 0; i < mindmapsData.length; i++) {
        const data = mindmapsData[i];
        wrMindmap(data.name, data.json);
      }
      if (licenceData.imageName) {
        wrMindmap(licenceData.imageName, licenceData.imageValue);
      }
      await zipFolder(key);
      const host = getFormattedUrl(req);
      rmDir("./public/key");

      RES(res, { message: "Success", mindmap: `${host}/${key}.zip` });
    } else {
      RES(res, { message: "Licence key expired", success: false }, 422);
    }
  } catch (error) {
    RES(res, { message: error.message, success: false }, 422);
  }
};

const getLink = async ({ query }, res) => {
  try {
    if (!query.hash) {
      RES(res, { success: false, message: "Please pass hash" }, 422);
      return;
    }
    const data = await links.findOne({
      where: { hash: query.hash },
      raw: true,
    });
    if (data) {
      RES(res, { success: true, data });
    } else {
      RES(res, { success: false, message: "Invalid link" });
    }
  } catch (error) {
    RES(res, { success: false, message: error.message }, 422);
  }
};

const shortLink = async ({ body }, res) => {
  try {
    if (!body.link) {
      RES(res, { success: false, message: "Please pass link" }, 422);
      return;
    }
    let linkAlreadyExist = await links.findOne({
      where: { link: body.link },
      raw: true,
    });
    if (linkAlreadyExist) {
      RES(res, { success: true, data: linkAlreadyExist });
      return;
    }
    let len = 2;
    let tried = 0;
    let hash;
    let exist;
    while (!exist) {
      if (tried > 2) len++;
      hash = generateHash(len);
      exist = !(await links.findOne({
        where: { hash },
        raw: true,
      }));
      tried++;
    }
    const data = await links.create({ link: body.link, hash });
    RES(res, { success: true, data });
  } catch (error) {
    RES(res, { success: false, message: error.message }, 422);
  }
};
const sendSMS = async (req, res) => {
  const API_KEY_LOCAL = "A39e1e65900618ef9b6e16da473f8894d";
 // const API_KET_PROD = "Aa0f6771f16f5b85a9b90a90834d17d86";
  const msgHost = "https://api.kaleyra.io/v1/HXIN1701481071IN/messages";
  const msgData = {
    sender: "TIFDOC",
    template_id: "1107162427070618591",
    source: "API",
    type: "TXN",
  };
  let body = new URLSearchParams();
  body.set("to", "91" + req.body.patientNo);
  body.set("sender", msgData.sender);
  body.set("source", msgData.source);
  body.set("body", req.body.smsBody);
  body.set("template_id", msgData.template_id);
  body.set("type", msgData.type);
  let sms = body.toString();
  try {
    const data = await new Promise((res, rej) => {
      request.post(
        msgHost,
        {
          form: sms,
          headers: {
            "api-key": API_KEY_LOCAL,
            "Content-Type": "application/x-www-form-urlencoded;",
          },
        },
        function (err, response) {
          if (err) rej(err);
          res(JSON.parse(response.body));
        }
      );
    });
    RES(res, { success: true, data });
  } catch (error) {
    RES(res, { success: false, message: error.message });
  }
};

const startCall = async (req, res) => {
  const msgHost = `https://d788e0b618b3143e0f2df466fdad155561aaee3b32e4327d:49df1e7a635d9c575365fc82cc07d1ac3eb770e2284fd25e@api.exotel.com/v1/Accounts/intelehealth2/Calls/connect`
  let body = new URLSearchParams();
  body.set("From", "0" + req.body.doctorsMobileNo);
  body.set("To", "0" + req.body.patientMobileNo);
  body.set("CallerId", '01141236457');
  let form = body.toString();
  try {
    const data = await new Promise((res, rej) => {
      request.post(msgHost, 
        { 
          form: form,
          headers: {
            "Content-Type": "application/x-www-form-urlencoded;",
          }
        },
        function (err, response) {
          if (err) rej(err);
          res(response);
      });
    });
    RES(res, { success: true, data });
  } catch (error) {
    RES(res, { success: false, message: error.message });
  }
};

module.exports = {
  getMindmapDetails,
  addUpdateLicenceKey,
  getMindmapKeys,
  addUpdateMindMap,
  deleteMindmapKey,
  downloadMindmaps,
  getLink,
  shortLink,
  sendSMS,
  startCall,
};
