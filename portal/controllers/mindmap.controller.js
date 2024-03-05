const { RES, asyncForEach } = require("../handlers/helper");
const { mindmaps, licences } = require("../models");
const { mkDir } = require("../public/javascripts/directory");
const { rmDir } = require("../public/javascripts/deletefile");
const { wrMindmap } = require("../public/javascripts/writefile");
const { zipFolder } = require("../public/javascripts/zip");
const { getFormattedUrl } = require("../public/javascripts/functions");
const { logStream } = require("../logger/index");

/**
 * Return mindmaps respect to key
 * @param {request} req
 * @param {response} res
 */
const getMindmapDetails = async (req, res) => {
  const key = req.params.key;
  logStream('debug', 'API calling', 'Get mindmap details');
  if (!key)
    logStream('debug', 'Mindmap Key missing', 'Get mindmap details');
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
  logStream("debug", 'Mindmaps Recieved', 'Get mindmap details');
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
    logStream('debug', 'API calling', 'Add Update LicenceKey');
    let data = await licences.findOne({
      where: { keyName: body.key },
    });
    logStream('debug', JSON.stringify(data), 'Got LicenceKey');
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
      message = body.type === "image" ? "Image updated" : "Updated successfully!";
      logStream('debug', JSON.stringify(data), 'Updated Existing LicenceKey');
    } else {
      data = await licences.create(dataToUpdate);
      message = body.type === "image" ? "Image uploaded" : "Added successfully!";
      logStream('debug', JSON.stringify(data), 'Updated Existing LicenceKey');
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
  try {
    logStream('debug', 'API calling', 'Get mindmap keys');
    RES(res, {
      data: await licences.findAll({
      attributes: ["keyName", "expiry", "imageValue", "imageName"],
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
  const body = req.body;
  let message = "";
  try {
    logStream('debug', 'API calling', 'Add Update MindMap');
    let data = await mindmaps.findOne({
      where: { keyName: body.key, name: body.filename },
    });
    logStream('debug', JSON.stringify(data), 'Got MindMap');
    let dataToUpdate = {
      name: body.filename,
      json: body.value,
      keyName: body.key,
    };
    if (data) {
      data = await data.update(dataToUpdate);
      message = "Mindmap updated successfully!";
      logStream('debug', JSON.stringify(data), 'Updated Existing MindMap');
    } else {
      data = await mindmaps.create(dataToUpdate);
      message = "Mindmap added successfully!";
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
  const key = req.params.key;
  const mindmapName = req.body.mindmapName;
  try {
    logStream('debug', 'API calling', 'Delete Mindmap Key');
    if (!key) {
      logStream('debug', 'Mindmap Key missing', 'Delete Mindmap Key');
      RES(res, {
        message: "Please enter a mindmap key",
        success: false,
      });
      return;
    }
    if (!mindmapName) {
      logStream('debug', 'Mindmap name missing', 'Delete Mindmap Key');
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
    logStream('debug', 'Mindmap deleted', 'Delete Mindmap Key');
    RES(res, {
      data,
      success: true,
      message: "Mindmap deleted successfully!",
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
  const key = req.query.key;
  try {
    logStream('debug', 'API calling', 'Download Mindmaps');
    if (!key) {
      logStream('debug', 'API calling', 'Download Mindmaps');
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
      logStream('debug', 'Not Found Mindmap Key', 'Download Mindmaps');
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
      logStream('debug', 'Downloaded Mindmaps', 'Download Mindmaps');
      RES(res, { message: "Success", mindmap: `${host}/${key}.zip` });
    } else {
      logStream('debug', 'Licence key expired', 'Download Mindmaps');
      RES(res, { message: "Licence key expired", success: false }, 422);
    }
  } catch (error) {
    logStream("error", error.message);
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
};
