const { RES } = require("../handlers/helper");
const { mindmaps, licences } = require("../models");
const { mkDir } = require("../handlers/directory");
const { rmDir } = require("../handlers/deletefile");
const { wrMindmap } = require("../handlers/writefile");
const { zipFolder } = require("../handlers/zip");
const { getFormattedUrl } = require("../handlers/functions");
const Sequelize = require('sequelize');
const Constant = require("../constants/constant");
const { MESSAGE } = require("../constants/messages");

/**
 * Return mindmaps respect to key
 * @param {request} req
 * @param {response} res
 */
const getMindmapDetails = async (req, res) => {
  const key = req.params.key;
  if (!key)
    RES(res, {
      message: MESSAGE.MINDMAP.PLEASE_ENTER_A_LICENCE_KEY,
    });

  RES(res, {
    data: await mindmaps.findAll({
      where: {
        keyName: key,
      },
      raw: false,
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
    if ((body.type === "image")) {
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
      message = body.type === "image" ? MESSAGE.COMMON.IMAGE_UPDATED : MESSAGE.COMMON.UPDATED_SUCCESSFULLY;
    } else {
      data = await licences.create(dataToUpdate);
      message = body.type === "image" ? MESSAGE.COMMON.IMAGE_UPLOADED : MESSAGE.COMMON.ADDED_SUCCESSFULLY;
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
      attributes: [
        Constant.KEY_NAME,
        Constant.EXPIRY,
        Constant.IMAGE_VALUE,
        Constant.IMAGE_NAME
      ],
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
      isActive: data ? data.isActive : true
    };
    if (data) {
      data = await data.update(dataToUpdate);
      message = MESSAGE.MINDMAP.MINDMAP_UPDATED_SUCCESSFULLY;
    } else {
      data = await mindmaps.create(dataToUpdate);
      message = MESSAGE.MINDMAP.MINDMAP_ADDED_SUCCESSFULLY;
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
        message: MESSAGE.MINDMAP.PLEASE_ENTER_A_MINDMAP_KEY,
        success: false,
      });
      return;
    }
    if (!mindmapName) {
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

    RES(res, {
      data,
      success: true,
      message: MESSAGE.MINDMAP.MINDMAP_DELETED_SUCCESSFULLY,
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

      RES(res, { message: MESSAGE.COMMON.SUCCESS, mindmap: `${host}/${key}.zip` });
    } else {
      RES(res, { message: MESSAGE.MINDMAP.LICENCE_KEY_EXPIRED, success: false }, 422);
    }
  } catch (error) {
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
    if (!(keyName && mindmapName)) {
      RES(res, { message: MESSAGE.COMMON.BAD_REQUEST, success: false }, 400);
    }
    let data = await mindmaps.update({ isActive: Sequelize.literal('NOT isActive') }, {
      where: { keyName: keyName, name: mindmapName }
    });
    if(data && data[0]) {
      data = await mindmaps.findOne({
        where: { keyName: keyName, name: mindmapName }
      })
      message = MESSAGE.MINDMAP.ACTIVE_STATUS_UPDATED_SUCCESSFULLY;
      RES(res, { data, success: true, message });
    } else {
      message = MESSAGE.MINDMAP.MINDMAP_NOT_FOUND;
      RES(res, { data: null, success: false, message });
    }
  } catch (error) {
    RES(res, { message: error.message, success: false }, 422);
  }
};

module.exports = {
  getMindmapDetails,
  addUpdateLicenceKey,
  getMindmapKeys,
  addUpdateMindMap,
  deleteMindmapKey,
  downloadMindmaps,
  toggleMindmapActiveStatus
};
