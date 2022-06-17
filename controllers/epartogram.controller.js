const { epartogram_configs } = require("../models");

/**
 * Return epartogram_configs respect to key
 * @param {request} req
 * @param {response} res
 */
 const getConfiguration = async (req, res) => {
  RES(res, {
    data: await epartogram_configs.findAll({
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
    let data = await epartogram_configs.findOne({
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
      data = await epartogram_configs.create(dataToUpdate);
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
  