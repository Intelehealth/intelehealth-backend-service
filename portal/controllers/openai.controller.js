const { MESSAGE } = require("../constants/messages");
const { RES } = require("../handlers/helper");
const { createCompletion, createCompletion2, translateExcel, getGTPInputs, addGTPInput, setAsDefaultGTPInput, deleteGPTInput, getGPTModels, addGPTModel, setAsDefaultGPTModel, deleteGPTModel } = require("../services/openai.service");
const { logStream } = require("../logger/index");

module.exports = (function () {
    /**
     * 
     * @param {*} req
     * @param {*} res
     */
    this.createCompletion = async (req, res) => {
      try {
        logStream('debug', 'API call', 'Create Completion');
        const { payload, inputtype, customInput } = req.body;
        if (payload && ((inputtype == 'default' && customInput == null) || (inputtype == 'custom' && customInput != null))) {
          const data = await createCompletion(payload, inputtype, customInput);
          logStream('debug', 'Success', 'Create Completion');
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
          logStream('debug', 'Bad request', 'Create Completion');
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
        logStream("error", error.message);
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
        logStream('debug', 'API call', 'Create Completion2');
        const { payload } = req.body;
        if (payload) {
          const data = await createCompletion2(payload);
          logStream('debug', 'Success', 'Create Completion2');
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
          logStream('debug', 'Bad request', 'Create Completion2');
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
        logStream("error", error.message);
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
        logStream('debug', 'API call', 'Get GTP Inputs');
        const data = await getGTPInputs();
        logStream('debug', 'Success', 'Get GTP Inputs');
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
        logStream("error", error.message);
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
        logStream('debug', 'API call', 'Add GTP Input');
        const { gptinput } = req.body;
        if (gptinput) {
          const data = await addGTPInput(gptinput);
          logStream('debug', 'Success', 'Add GTP Input');
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
          logStream('debug', 'Bad request', 'Add GTP Input');
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
        logStream("error", error.message);
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
        logStream('debug', 'API call', 'Set As Default GTP Input');
        const { id } = req.body;
        if (id) {
          const data = await setAsDefaultGTPInput(id);
          logStream('debug', 'Success', 'Set As Default GTP Input');
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
          logStream('debug', 'Bad request', 'Set As Default GTP Input');
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
        logStream("error", error.message);
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
        logStream('debug', 'API call', 'Delete GPT Input');
        const { id } = req.params;
        if (id) {
          const data = await deleteGPTInput(id);
          logStream('debug', 'Success', 'Delete GPT Input');
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
          logStream('debug', 'Bad request', 'Delete GPT Input');
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
        logStream("error", error.message);
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
        logStream('debug', 'API call', 'Get GPT Models');
        const data = await getGPTModels();
        logStream('debug', 'Success', 'Get GPT Models');
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
        logStream("error", error.message);
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
        logStream('debug', 'API call', 'Add GPT Model');
        const { model } = req.body;
        if (model) {
          const data = await addGPTModel(model);
          logStream('debug', 'Success', 'Add GPT Model');
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
          logStream('debug', 'Bad request', 'Add GPT Model');
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
        logStream("error", error.message);
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
        logStream('debug', 'API call', 'Set As Default GPT Model');
        const { id } = req.body;
        if (id) {
          const data = await setAsDefaultGPTModel(id);
          logStream('debug', 'Success', 'Set As Default GPT Model');
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
          logStream('debug', 'Bad request', 'Set As Default GPT Model');
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
        logStream("error", error.message);
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
        logStream('debug', 'API call', 'Delete GPT Model');
        const { id } = req.params;
        if (id) {
          const data = await deleteGPTModel(id);
          logStream('debug', 'Success', 'Delete GPT Model');
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
          logStream('debug', 'Bad request', 'Delete GPT Model');
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
        logStream("error", error.message);
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
        logStream('debug', 'API call', 'Translate Excel');
        const file = req.file;
        const { language } = req.body;
        if (file && language) {
          const data = await translateExcel(file, language);
          if (data.success) {
            res.download('public/translate/translated.xlsx');
          } else {
            logStream('debug', 'Success', 'Translate Excel');
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
          logStream('debug', 'Bad request', 'Translate Excel');
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
        logStream("error", error.message);
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