const { MESSAGE } = require("../constants/messages");
const { RES } = require("../handlers/helper");
const { createCompletion, createCompletion2, translateExcel, getGTPInputs, addGTPInput, setAsDefaultGTPInput, deleteGPTInput, getGPTModels, addGPTModel, setAsDefaultGPTModel, deleteGPTModel } = require("../services/openai.service");

module.exports = (function () {
    /**
     * 
     * @param {*} req
     * @param {*} res
     */
    this.createCompletion = async (req, res) => {
      try {
        const { payload, inputtype, customInput } = req.body;
        if (payload && ((inputtype == 'default' && customInput == null) || (inputtype == 'custom' && customInput != null))) {
          const data = await createCompletion(payload, inputtype, customInput);
          RES(
            res,
            {
              success: data.success,
              message: data.message,
              data: data.data,
            },
            data.code
          );
        } else {
          RES(
            res,
            {
              success: false,
              message: MESSAGE.COMMON.BAD_REQUEST,
              data: null,
            },
            400
          );
        }
      } catch (error) {
        if (error.code === null || error.code === undefined) {
          error.code = 500;
        }
        RES(
          res,
          { success: false, data: error.data, message: error.message },
          error.code
        );
      }
    };

    /**
     * 
     * @param {*} req
     * @param {*} res
     */
    this.createCompletion2 = async (req, res) => {
      try {
        const { payload } = req.body;
        if (payload) {
          const data = await createCompletion2(payload);
          RES(
            res,
            {
              success: data.success,
              message: data.message,
              data: data.data,
            },
            data.code
          );
        } else {
          RES(
            res,
            {
              success: false,
              message: MESSAGE.COMMON.BAD_REQUEST,
              data: null,
            },
            400
          );
        }
      } catch (error) {
        if (error.code === null || error.code === undefined) {
          error.code = 500;
        }
        RES(
          res,
          { success: false, data: error.data, message: error.message },
          error.code
        );
      }
    };

    /**
     * 
     * @param {*} req
     * @param {*} res
     */
    this.getGTPInputs = async (req, res) => {
      try {
        const data = await getGTPInputs();
        RES(
          res,
          {
            success: data.success,
            message: data.message,
            data: data.data,
          },
          data.code
        );
      } catch (error) {
        if (error.code === null || error.code === undefined) {
          error.code = 500;
        }
        RES(
          res,
          { success: false, data: error.data, message: error.message },
          error.code
        );
      }
    };

    /**
     * 
     * @param {*} req
     * @param {*} res
     */
    this.addGTPInput = async (req, res) => {
      try {
        const { gptinput } = req.body;
        if (gptinput) {
          const data = await addGTPInput(gptinput);
          RES(
            res,
            {
              success: data.success,
              message: data.message,
              data: data.data,
            },
            data.code
          );
        } else {
          RES(
            res,
            {
              success: false,
              message: MESSAGE.COMMON.BAD_REQUEST,
              data: null,
            },
            400
          );
        }
      } catch (error) {
        if (error.code === null || error.code === undefined) {
          error.code = 500;
        }
        RES(
          res,
          { success: false, data: error.data, message: error.message },
          error.code
        );
      }
    };

    /**
     * 
     * @param {*} req
     * @param {*} res
     */
    this.setAsDefaultGTPInput = async (req, res) => {
      try {
        const { id } = req.body;
        if (id) {
          const data = await setAsDefaultGTPInput(id);
          RES(
            res,
            {
              success: data.success,
              message: data.message,
              data: data.data,
            },
            data.code
          );
        } else {
          RES(
            res,
            {
              success: false,
              message: MESSAGE.COMMON.BAD_REQUEST,
              data: null,
            },
            400
          );
        }
      } catch (error) {
        if (error.code === null || error.code === undefined) {
          error.code = 500;
        }
        RES(
          res,
          { success: false, data: error.data, message: error.message },
          error.code
        );
      }
    };

    /**
     * 
     * @param {*} req
     * @param {*} res
     */
    this.deleteGPTInput = async (req, res) => {
      try {
        const { id } = req.params;
        if (id) {
          const data = await deleteGPTInput(id);
          RES(
            res,
            {
              success: data.success,
              message: data.message,
              data: data.data,
            },
            data.code
          );
        } else {
          RES(
            res,
            {
              success: false,
              message: MESSAGE.COMMON.BAD_REQUEST,
              data: null,
            },
            400
          );
        }
      } catch (error) {
        if (error.code === null || error.code === undefined) {
          error.code = 500;
        }
        RES(
          res,
          { success: false, data: error.data, message: error.message },
          error.code
        );
      }
    };

    /**
     * 
     * @param {*} req
     * @param {*} res
     */
    this.getGPTModels = async (req, res) => {
      try {
        const data = await getGPTModels();
        RES(
          res,
          {
            success: data.success,
            message: data.message,
            data: data.data,
          },
          data.code
        );
      } catch (error) {
        if (error.code === null || error.code === undefined) {
          error.code = 500;
        }
        RES(
          res,
          { success: false, data: error.data, message: error.message },
          error.code
        );
      }
    };

    /**
     * 
     * @param {*} req
     * @param {*} res
     */
    this.addGPTModel = async (req, res) => {
      try {
        const { model } = req.body;
        if (model) {
          const data = await addGPTModel(model);
          RES(
            res,
            {
              success: data.success,
              message: data.message,
              data: data.data,
            },
            data.code
          );
        } else {
          RES(
            res,
            {
              success: false,
              message: MESSAGE.COMMON.BAD_REQUEST,
              data: null,
            },
            400
          );
        }
      } catch (error) {
        if (error.code === null || error.code === undefined) {
          error.code = 500;
        }
        RES(
          res,
          { success: false, data: error.data, message: error.message },
          error.code
        );
      }
    };

    /**
     * 
     * @param {*} req
     * @param {*} res
     */
    this.setAsDefaultGPTModel = async (req, res) => {
      try {
        const { id } = req.body;
        if (id) {
          const data = await setAsDefaultGPTModel(id);
          RES(
            res,
            {
              success: data.success,
              message: data.message,
              data: data.data,
            },
            data.code
          );
        } else {
          RES(
            res,
            {
              success: false,
              message: MESSAGE.COMMON.BAD_REQUEST,
              data: null,
            },
            400
          );
        }
      } catch (error) {
        if (error.code === null || error.code === undefined) {
          error.code = 500;
        }
        RES(
          res,
          { success: false, data: error.data, message: error.message },
          error.code
        );
      }
    };

    /**
     * 
     * @param {*} req
     * @param {*} res
     */
    this.deleteGPTModel = async (req, res) => {
      try {
        const { id } = req.params;
        if (id) {
          const data = await deleteGPTModel(id);
          RES(
            res,
            {
              success: data.success,
              message: data.message,
              data: data.data,
            },
            data.code
          );
        } else {
          RES(
            res,
            {
              success: false,
              message: MESSAGE.COMMON.BAD_REQUEST,
              data: null,
            },
            400
          );
        }
      } catch (error) {
        if (error.code === null || error.code === undefined) {
          error.code = 500;
        }
        RES(
          res,
          { success: false, data: error.data, message: error.message },
          error.code
        );
      }
    };

    /**
     * 
     * @param {*} req
     * @param {*} res
     */
    this.translateExcel = async (req, res) => {
      try {
        const file = req.file;
        const { language } = req.body;
        if (file && language) {
          const data = await translateExcel(file, language);
          if (data.success) {
            res.download('public/translate/translated.xlsx');
          } else {
            RES(
              res,
              {
                success: data.success,
                message: data.message,
                data: data.data,
              },
              data.code
            );
          }
        } else {
          RES(
            res,
            {
              success: false,
              message: MESSAGE.COMMON.BAD_REQUEST,
              data: null,
            },
            400
          );
        }
      } catch (error) {
        if (error.code === null || error.code === undefined) {
          error.code = 500;
        }
        RES(
          res,
          { success: false, data: error.data, message: error.message },
          error.code
        );
      }
    };
  
    return this;
  })();