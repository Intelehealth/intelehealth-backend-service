const { Configuration, OpenAIApi } = require("openai");
const configuration = new Configuration({
    // organization: config[env].openaiOrganizationId,
    apiKey: process.env.OPEN_AI_KEY
});
const openai = new OpenAIApi(configuration);
const { gptinputs, gptmodels, Sequelize, sequelize } = require("../models");
const axios = require("axios");
const readXlsxFile = require('read-excel-file/node');
const xlsx = require('node-xlsx').default;
const fs = require('fs');

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
            let gptModel = 'gpt-4-0613';
            const gptModels = await gptmodels.findAll({
                where: {
                    isDefault: true
                }
            });
            gptModel = gptModels.length ? gptModels[0].model : 'gpt-4-0613';

            if (gptModel == 'specialized-llm') {
                const axiosInstance = axios.create({
                    baseURL: 'https://ci.intelehealth.org',
                    timeout: 50000,
                });
                const response = await axiosInstance.post('/ask', { question: `${gptInput} ${payload}` });
                return {
                    code: 200,
                    success: true,
                    message: "Chat completion created successfully!",
                    data: { output: { choices: [{ message: { content: response.data.data } }] }, model: gptModel }
                };
            } else {
                const response = await openai.createChatCompletion({
                    model: gptModel,
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
                    data: { output: response.data, model: gptModel }
                };
            }
        } catch (error) {
            if (error.code === null || error.code === undefined) {
                error.code = 500;
            }
            return { code: error.code, success: false, data: error.data, message: error.message };
        }

    };

    this.createCompletion2 = async function (payload) {
        try {
            const response = await openai.createChatCompletion({
                model: 'gpt-3.5-turbo-0613',
                messages: [
                    {
                        role: "user",
                        content: `Translate the below words/sentences to russian language in a json object format where key is the word/sentence and value will be the translation:  ${payload}`
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
            if (error.code === null || error.code === undefined) {
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
            if (error.code === null || error.code === undefined) {
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
                message: "GPT Input added successfully!",
                data: data
            };
        } catch (error) {
            if (error.code === null || error.code === undefined) {
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
                            [Sequelize.Op.not]: id
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
            if (error.code === null || error.code === undefined) {
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
            if (error.code === null || error.code === undefined) {
                error.code = 500;
            }
            return { code: error.code, success: false, data: error.data, message: error.message };
        }
    };

    this.getGPTModels = async function () {
        try {
            const response = await gptmodels.findAll({
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
                message: "List of GPT models retreived successfully!",
                data: response
            };
        } catch (error) {
            if (error.code === null || error.code === undefined) {
                error.code = 500;
            }
            return { code: error.code, success: false, data: error.data, message: error.message };
        }
    };

    this.addGPTModel = async function (model) {
        try {
            const data = await gptmodels.create({
                model
            });
            return {
                code: 200,
                success: true,
                message: "GPT model added successfully!",
                data: data
            };
        } catch (error) {
            if (error.code === null || error.code === undefined) {
                error.code = 500;
            }
            return { code: error.code, success: false, data: error.data, message: error.message };
        }
    };

    this.setAsDefaultGPTModel = async function (id) {
        try {

            const response = await gptmodels.update(
                { isDefault: false },
                {
                    where: {
                        id: {
                            [Sequelize.Op.not]: id
                        }
                    }
                }
            );
            const data = await gptmodels.update(
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
                message: "GPT model set as default successfully!",
                data: data
            };
        } catch (error) {
            if (error.code === null || error.code === undefined) {
                error.code = 500;
            }
            return { code: error.code, success: false, data: error.data, message: error.message };
        }
    };

    this.deleteGPTModel = async function (id) {
        try {
            const data = await gptmodels.destroy(
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
                    message: "GPT model deleted successfully!",
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
            if (error.code === null || error.code === undefined) {
                error.code = 500;
            }
            return { code: error.code, success: false, data: error.data, message: error.message };
        }
    };

    this.translateExcel = async function (file, language) {
        try {
            const data = await readXlsxFile(file.path);
            // const workSheetsFromFile = xlsx.parse(file.path);
            let words = [];
            let jsonObject = { };
            for (let i = 1; i < data.length; i++) {
                if (data[i][0]) {
                    words.push(data[i][0]);
                    jsonObject[data[i][0]] = null;
                }
            }
            let pages = Math.ceil(words.length/25);
            for (let i = 0; i < pages; i++) {
                let input = words.slice(i*25, ((i+1)*25) - 1).join("\n");
                const response = await openai.createChatCompletion({
                    model: 'gpt-3.5-turbo-16k-0613',
                    messages: [
                        {
                            role: "user",
                            content: `Translate the below words/sentences to ${language} language in a json object format where key is the word/sentence and value will be the translation:  ${input}`
                        }
                    ]
                });
                if (response.data.choices[0].message.content.endsWith('}')) {
                    const translation = JSON.parse(response.data.choices[0].message.content);
                    for (const key in translation) {
                        if (translation.hasOwnProperty(key)) {
                            jsonObject[key] = translation[key];
                        }
                    }
                } else {
                    for (let j = 0; j < 2; j++) {
                        let input = words.slice(i*25, ((i+1)*25) - 1).slice(j*13, ((j+1)*13) - 1).join("\n");
                        const response = await openai.createChatCompletion({
                            model: 'gpt-3.5-turbo-16k-0613',
                            messages: [
                                {
                                    role: "user",
                                    content: `Translate the below words/sentences to ${language} language in a json object format where key is the word/sentence and value will be the translation:  ${input}`
                                }
                            ]
                        });
                        const translation = JSON.parse(response.data.choices[0].message.content);
                        for (const key in translation) {
                            if (translation.hasOwnProperty(key)) {
                                jsonObject[key] = translation[key];
                            }
                        }
                    }
                }
            }
            let translateddata = [];
            for (let i = 0; i < data.length; i++) {
                if (data[i][0]) {
                    if (i == 0) {
                        translateddata.push(data[i])
                    } else {
                        translateddata.push([data[i][0], data[i][1], jsonObject[data[i][0]]]);
                    }
                }
            }
            const buffer = xlsx.build([{name: 'translation', data: translateddata}]);
            fs.writeFileSync('public/translate/translated.xlsx', buffer);
            fs.unlinkSync(file.path);
            return {
                code: 200,
                success: true,
                message: "Chat completion created successfully!",
                data: buffer
            };
        } catch (error) {
            if (error.code === null || error.code === undefined) {
                error.code = 500;
            }
            return { code: error.code, success: false, data: error.data, message: error.message };
        }

    };

    return this;
})();