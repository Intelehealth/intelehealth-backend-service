const { RES } = require("../handlers/helper");
const { getModels } = require('../db/context');

/**
 * Return epartogram_configs respect to key
 * @param {request} req
 * @param {response} res
 */
 const getConfiguration = async (req, res) => {
  const models = getModels();
  RES(res, {
    data: await models.epartogram_configs.findAll({
      attributes: ["name", "value", "id"],
    }),
    success: true,
  });
  };

  /**
 * Return epartogram_configs respect to key
 * @param {request} req
 * @param {response} res
 */
 const addUpdateConfiguration = async (req, res) => {
  const body = req.body;
  let message = "";
  try {
    const models = getModels();
    let data = await models.epartogram_configs.findOne({
      where: { name: body.name},
    });
    let dataToUpdate = {
      name: body.name,
      value: body.value
    };
    if (data) {
      data = await data.update(dataToUpdate);
      message = `${body.name} configuration updated successfully!`;
    } else {
      data = await models.epartogram_configs.create(dataToUpdate);
      message = `${body.name} configurations added successfully!`;
    }
    RES(res, { data, success: true, message });
  } catch (error) {
    RES(res, { message: error.message, success: false }, 422);
  }
  };

  module.exports = {
    getConfiguration,
    addUpdateConfiguration
  };
  