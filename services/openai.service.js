const config = require('../config/config.json');
const { Configuration, OpenAIApi } = require("openai");
const env = process.env.NODE_ENV ? process.env.NODE_ENV : "production";
const configuration = new Configuration({
    organization: config[env].openaiOrganizationId,
    apiKey: config[env].openaiApiKey,
});
const openai = new OpenAIApi(configuration);
const { gptinputs, Sequelize, sequelize } = require("../models");

module.exports = (function () {

    this.createCompletion = async function (payload, inputtype, customInput) {
        try {
            let gptInput = '';
            if (inputtype == 'default') {
                const data = await gptinputs.findAll({
                    where: {
                        isDefault: true
                    }
                });
                gptInput = data.length ? data[0].gptinput : 'Provide a Differential diagnosis with likelihood-likelihood-matrix, recommended diagnostics and recommended treatment plans in a four column table format with the Likelihood numeric scores (out of 10) ranked in descending order. Keep in mind the demographic background of the patient - ';
            }
            if (inputtype == 'custom') {
                gptInput = customInput;
            }
            const response = await openai.createChatCompletion({
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: "user",
                        content: `${gptInput} ${payload}`
                    }
                ]
            });
            return {
                code: 200,
                success: true,
                message: "Chat completion created successfully!",
                data: response.data
            };
        } catch (error) {
            if(error.code === null || error.code === undefined){
                error.code = 500;
            }
            return { code: error.code, success: false, data: error.data, message: error.message };
        }
        
    };

    this.getGTPInputs = async function () {
        try {
            const response = await gptinputs.findAll({
                where: {
                    id: {
                        [Sequelize.Op.not]: null
                    }
                },
                order: [
                    ['id', 'DESC']
                ],
            });
            return {
                code: 200,
                success: true,
                message: "List of GPT Inputs retreived successfully!",
                data: response
            };
        } catch (error) {
            if(error.code === null || error.code === undefined){
                error.code = 500;
            }
            return { code: error.code, success: false, data: error.data, message: error.message };
        }
    };

    this.addGTPInput = async function (gptinput) {
        try {
            const data = await gptinputs.create({
               gptinput
            });
            return {
                code: 200,
                success: true,
                message: "GPT Input added successfully successfully!",
                data: data
            };
        } catch (error) {
            if(error.code === null || error.code === undefined){
                error.code = 500;
            }
            return { code: error.code, success: false, data: error.data, message: error.message };
        }
    };

    this.setAsDefaultGTPInput = async function (id) {
        try {

            const response = await gptinputs.update(
                { isDefault: false },
                {
                  where: {
                    id: {
                        [Sequelize.Op.not] : id
                    }
                  }
                }
            );
            const data = await gptinputs.update(
                { isDefault: true },
                {
                  where: {
                    id: id
                  }
                }
            );
            return {
                code: 200,
                success: true,
                message: "GPT Input set as default successfully!",
                data: data
            };
        } catch (error) {
            if(error.code === null || error.code === undefined){
                error.code = 500;
            }
            return { code: error.code, success: false, data: error.data, message: error.message };
        }
    };

    this.deleteGPTInput = async function (id) {
        try {
            const data = await gptinputs.destroy(
                {
                  where: {
                    id: id,
                    isDefault: false
                  }
                }
            );
            if (data) {
                return {
                    code: 200,
                    success: true,
                    message: "GPT Input deleted successfully!",
                    data: null
                };
            } else {
                return {
                    code: 200,
                    success: false,
                    message: "Can't delete default GPT Input/No GPT Input with such id exists!",
                    data: null
                };
            }
            
        } catch (error) {
            if(error.code === null || error.code === undefined){
                error.code = 500;
            }
            return { code: error.code, success: false, data: error.data, message: error.message };
        }
    };

    return this;
})();