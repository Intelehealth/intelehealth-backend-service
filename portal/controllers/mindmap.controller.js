const { RES } = require("../handlers/helper");
const { mindmaps, licences, translation_analysis } = require("../models");
const { mkDir } = require("../handlers/directory");
const { rmDir } = require("../handlers/deletefile");
const { wrMindmap } = require("../handlers/writefile");
const { zipFolder } = require("../handlers/zip");
const { getFormattedUrl } = require("../handlers/functions");
const { logStream } = require("../logger/index");
const { MESSAGE } = require("../constants/messages");
const Sequelize = require('sequelize');
const Constant = require("../constants/constant");
const { axiosInstance } = require("../handlers/helper");

/**
 * Return mindmaps respect to key
 * @param {request} req
 * @param {response} res
 */
const getMindmapDetails = async (req, res) => {
  try {
    logStream('debug', 'API calling', 'Get mindmap details');
    const { key } = req.params;
    if (!key) {
      RES(res, {
        message: MESSAGE.MINDMAP.PLEASE_ENTER_A_LICENCE_KEY,
      });
      logStream('debug', 'Mindmap Key missing', 'Get mindmap details');
    }
    RES(res, {
      data: await mindmaps.findAll({
        where: {
          keyName: key,
        },
        raw: false,
      }),
    });
    logStream("debug", 'Mindmaps Recieved', 'Get mindmap details');
  } catch (error) {
    logStream("error", error.message);
    RES(res, { message: error.message, success: false }, 422);
  }
};

/**
 * Add/Update licence key
 * @param {request} req
 * @param {response} res
 */
const addUpdateLicenceKey = async (req, res) => {
  const { imageName, imageValue, key, expiryDate, type } = req.body;
  let message = "";
  let dataToUpdate;
  try {
    logStream('debug', 'API calling', 'Add Update LicenceKey');
    let data = await licences.findOne({
      where: { keyName: key },
    });
    logStream('debug', JSON.stringify(data), 'Got LicenceKey');
    if ((type === "image")) {
      dataToUpdate = {
        imageName: imageName,
        imageValue: imageValue,
      };
    } else {
      dataToUpdate = {
        keyName: key,
        expiry: expiryDate,
      };
    }
    if (data) {
      data = await data.update(dataToUpdate);
      message = type === "image" ? MESSAGE.COMMON.IMAGE_UPDATED : MESSAGE.COMMON.UPDATED_SUCCESSFULLY;
      logStream('debug', JSON.stringify(data), 'Updated Existing LicenceKey');
    } else {
      data = await licences.create(dataToUpdate);
      message = type === "image" ? MESSAGE.COMMON.IMAGE_UPLOADED : MESSAGE.COMMON.ADDED_SUCCESSFULLY;
      logStream('debug', JSON.stringify(data), 'Added New LicenceKey');
    }
    RES(res, { data, success: true, message });
  } catch (error) {
    logStream("error", error.message);
    RES(res, { message: error.message, success: false }, 422);
  }
};

/**
 * Return all mindmaps keys
 * @param {request} req
 * @param {response} res
 */
const getMindmapKeys = async (req, res) => {
  try {
    logStream('debug', 'API calling', 'Get mindmap keys')
    RES(res, {
      data: await licences.findAll({
        attributes: [
          Constant.KEY_NAME,
          Constant.EXPIRY,
          Constant.IMAGE_VALUE,
          Constant.IMAGE_NAME
        ],
      }),
      success: true,
    });
    logStream("debug", 'Mindmap Keys Recieved', 'Get Mindmap Keys');
  } catch (error) {
    logStream("error", error.message);
    RES(res, { message: error.message, success: false }, 422);
  }
};

/**
 * Add/Update mindmap
 * @param {request} req
 * @param {response} res
 */
const addUpdateMindMap = async (req, res) => {
  const { filename, key, value } = req.body;
  let message = "";
  try {
    logStream('debug', 'API calling', 'Add Update MindMap')
    let data = await mindmaps.findOne({
      where: { keyName: key, name: filename },
    });
    logStream('debug', JSON.stringify(data), 'Got MindMap');
    const dataToUpdate = {
      name: filename,
      json: value,
      keyName: key,
      isActive: data ? data.isActive : true
    };
    if (data) {
      data = await data.update(dataToUpdate);
      message = MESSAGE.MINDMAP.MINDMAP_UPDATED_SUCCESSFULLY;
      logStream('debug', JSON.stringify(data), 'Updated Existing MindMap');
    } else {
      data = await mindmaps.create(dataToUpdate);
      message = MESSAGE.MINDMAP.MINDMAP_ADDED_SUCCESSFULLY;
      logStream('debug', JSON.stringify(data), 'Added New MindMap');
    }
    RES(res, { data, success: true, message });
  } catch (error) {
    logStream("error", error.message);
    RES(res, { message: error.message, success: false }, 422);
  }
};

/**
 * Delete mindmap key
 * @param {request} req
 * @param {response} res
 */
const deleteMindmapKey = async (req, res) => {
  const { key } = req.params;
  const { mindmapName } = req.body;
  try {
    logStream('debug', 'API calling', 'Delete Mindmap Key')
    if (!key) {
      logStream('debug', 'Mindmap Key missing', 'Delete Mindmap Key');
      RES(res, {
        message: MESSAGE.MINDMAP.PLEASE_ENTER_A_MINDMAP_KEY,
        success: false,
      });
      return;
    }
    if (!mindmapName) {
      logStream('debug', 'Mindmap name missing', 'Delete Mindmap Key');
      RES(res, {
        message: MESSAGE.MINDMAP.PLEASE_PASS_A_MINDMAP_NAME,
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
    logStream('debug', 'Mindmap deleted', 'Delete Mindmap Key');
    RES(res, {
      data,
      success: true,
      message: MESSAGE.MINDMAP.MINDMAP_DELETED_SUCCESSFULLY,
    });
  } catch (error) {
    logStream("error", error.message);
    RES(res, { message: error.message, success: false }, 422);
  }
};

/**
 * Download mindmap zip
 * @param {request} req
 * @param {response} res
 */
const downloadMindmaps = async (req, res) => {
  const { key } = req.query;
  try {
    logStream('debug', 'API calling', 'Download Mindmaps')
    if (!key) {
      logStream('debug', 'Mindmap Key missing', 'Download Mindmaps');
      RES(res, {
        message: MESSAGE.MINDMAP.PLEASE_PASS_A_LICENCE_KEY,
        success: false,
      });
      return;
    }

    const licenceData = await licences.findOne({
      where: {
        keyName: key,
        isActive: true
      },
      raw: true,
    });

    if (!licenceData) {
      logStream('debug', 'Not Found Mindmap Key', 'Download Mindmaps');
      RES(res, {
        message: MESSAGE.MINDMAP.LICENCE_KEY_DIDNOT_FOUND_IN_THE_DATABASE,
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
      logStream('debug', 'Downloaded Mindmaps', 'Download Mindmaps');
      RES(res, { message: MESSAGE.COMMON.SUCCESS, mindmap: `${host}/${key}.zip` });
    } else {
      logStream('debug', 'Licence key expired', 'Download Mindmaps');
      RES(res, { message: MESSAGE.MINDMAP.LICENCE_KEY_EXPIRED, success: false }, 422);
    }
  } catch (error) {
    logStream("error", error.message);
    RES(res, { message: error.message, success: false }, 422);
  }
};

/**
 * Add/Update licence key
 * @param {request} req
 * @param {response} res
 */
const toggleMindmapActiveStatus = async (req, res) => {
  const { keyName, mindmapName } = req.body;
  try {
    logStream('debug', 'API calling', 'Toggle Mindmap Active Status')
    if (!(keyName && mindmapName)) {
      logStream('debug', 'Missing Arguments', 'Toggle Mindmap Active Status');
      RES(res, { message: MESSAGE.COMMON.BAD_REQUEST, success: false }, 400);
    }
    let data = await mindmaps.update({ isActive: Sequelize.literal('NOT isActive') }, {
      where: { keyName: keyName, name: mindmapName }
    });
    if (data && data[0]) {
      data = await mindmaps.findOne({
        where: { keyName: keyName, name: mindmapName }
      })
      message = MESSAGE.MINDMAP.ACTIVE_STATUS_UPDATED_SUCCESSFULLY;
      logStream('debug', 'Status Updated Successfully', 'Toggle Mindmap Active Status');
      RES(res, { data, success: true, message });
    } else {
      message = MESSAGE.MINDMAP.MINDMAP_NOT_FOUND;
      logStream('debug', 'Mindmap Not Found', 'Toggle Mindmap Active Status');
      RES(res, { data: null, success: false, message });
    }
  } catch (error) {
    logStream("error", error.message);
    RES(res, { message: error.message, success: false }, 422);
  }
};

/**
 * Add/Update licence key
 * @param {request} req
 * @param {response} res
 */
const getTranslation = async (req, res) => {
  try {
    logStream('debug', 'Get Sarvam Translation call', 'Get Translation');
    const { textToTranslate, targetLang, tabType } = req.body;
    if (!textToTranslate || !targetLang || !tabType) {
      return res.status(400).json({ error: "Missing required parameters" });
    }
    let body = buildRequestBody(textToTranslate, targetLang, tabType);
    // 🔹 Call Sarvam API
    const sarvamRes = await axiosInstance.post(
      process.env.SARVAM_URL, // replace with actual endpoint
      body,
      {
        headers: {
          "Content-Type": "application/json",
          "api-subscription-key": process.env.SARVAM_API_KEY, // store key in .env
        },
      }
    );
    logStream('debug', 'Sarvam translation received', 'Get Translation');
    return res.json(sarvamRes.data);
  } catch (error) {
     logStream('debug', error.response?.data, 'Get Sarvam Translation failed');
    res.status(500).json({ error: "Translation failed", details: error.response?.data });
  }
};

/**
 * Create or update a translation record
 * @param {request} req
 * @param {response} res
 */
const saveTranslation = async (req, res) => {
  try {
    const {
      visitId,
      conceptId,
      is_rejected,
      rejected_en_text,
      rejected_regional_text,
      created_by,
      api_failure_retry_counts
    } = req.body;

    if (!visitId || !conceptId) {
      return res.status(400).json({ message: 'visitId and conceptId are required' });
    }

    // 1️⃣ If retry count is provided → update existing record (or create one if it doesn't exist yet)
    if (typeof api_failure_retry_counts !== 'undefined') {
      let translation = await translation_analysis.findOne({
        where: { visitId, conceptId, is_rejected },
      });

      if (translation) {
        translation.api_failure_retry_counts = api_failure_retry_counts;
        translation.updated_datetime = new Date();
        await translation.save();
        return res.json({ message: 'Retry count updated', data: translation });
      }

      // If no record exists yet, create one for retry count
      const newTranslation = await translation_analysis.create({
        visitId,
        conceptId,
        api_failure_retry_counts,
        rejected_en_text,
        rejected_regional_text,
        created_by: created_by || null,
        created_datetime: new Date(),
        updated_datetime: new Date(),
      });

      return res.json({ message: 'Retry count record created', data: newTranslation });
    }

    // 2️⃣ For each rejected text, create a new record (don’t reuse existing)
    const newTranslation = await translation_analysis.create({
      visitId,
      conceptId,
      is_rejected: is_rejected ?? true,
      rejected_en_text: rejected_en_text || null,
      rejected_regional_text: rejected_regional_text || null,
      created_by: created_by || null,
      api_failure_retry_counts: 0,          // default when creating rejection records
      created_datetime: new Date(),
      updated_datetime: new Date(),
    });

    return res.json({ message: 'Rejected text record created', data: newTranslation });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};
  // A reusable function to build translation request body
  const buildRequestBody = (input, targetLang, tabType) => {
    return {
      input: input,
      source_language_code: "en-IN",
      target_language_code: targetLang,
      mode: "formal",
      model: "sarvam-translate:v1",
      numerals_format: "native",
      speaker_gender: "Male",
      enable_preprocessing: true,
      tabType: tabType
    };
  };

module.exports = {
  getMindmapDetails,
  addUpdateLicenceKey,
  getMindmapKeys,
  addUpdateMindMap,
  deleteMindmapKey,
  downloadMindmaps,
  toggleMindmapActiveStatus,
  getTranslation,
  saveTranslation
};
