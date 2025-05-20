const { Configuration, OpenAIApi, OpenAI } = require("openai");
// const configuration = new Configuration({
//     apiKey: process.env.OPEN_AI_KEY,
// });
const openai = new OpenAI({
    apiKey: process.env.OPEN_AI_KEY
});
const { gptinputs, gptmodels, Sequelize, sequelize, chatgptmodels, chatgptprompts } = require("../models");
const axios = require("axios");
const readXlsxFile = require('read-excel-file/node');
const xlsx = require('node-xlsx').default;
const fs = require('fs');
const { MESSAGE } = require("../constants/messages");
const { logStream } = require("../logger/index");

module.exports = (function () {

    /**
     * Create chatgpt completion
     * @param { string } payload - Payload
     * @param { string } inputtype - Input type
     * @param { string } customInput - Custom input
     */
    this.createCompletion = async function (payload, inputtype, customInput) {
        try {
            logStream('debug','Openai Service', 'Create Completion');
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
                    baseURL: process.env.OPEN_AI_BASE_URL,
                    timeout: 50000,
                });
                const response = await axiosInstance.post('/ask', { question: `${gptInput} ${payload}` });
                return {
                    code: 200,
                    success: true,
                    message: MESSAGE.OPEN_AI.CHAT_COMPLETION_CREATED_SUCCESSFULLY,
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
                    message: MESSAGE.OPEN_AI.CHAT_COMPLETION_CREATED_SUCCESSFULLY,
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

    /**
     * Create chatgpt completion
     * @param { string } payload - Payload
     */
    this.createCompletion2 = async function (payload) {
        try {
            logStream('debug','Openai Service', 'Create Completion2');
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
                message: MESSAGE.OPEN_AI.CHAT_COMPLETION_CREATED_SUCCESSFULLY,
                data: response.data
            };
        } catch (error) {
            if (error.code === null || error.code === undefined) {
                error.code = 500;
            }
            return { code: error.code, success: false, data: error.data, message: error.message };
        }

    };

    /**
     * Get chatgpt inputs saved in database
     */
    this.getGTPInputs = async function () {
        try {
            logStream('debug','Openai Service', 'Get GTP Inputs');
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
                message: MESSAGE.OPEN_AI.LIST_OF_GPT_INPUTS_RETREIVED_SUCCESSFULLY,
                data: response
            };
        } catch (error) {
            if (error.code === null || error.code === undefined) {
                error.code = 500;
            }
            return { code: error.code, success: false, data: error.data, message: error.message };
        }
    };

    /**
     * Create chatgpt input
     * @param { string } gptInput - GPT input
     */
    this.addGTPInput = async function (gptinput) {
        try {
            logStream('debug','Openai Service', 'add GTP Input');
            const data = await gptinputs.create({
                gptinput
            });
            return {
                code: 200,
                success: true,
                message: MESSAGE.OPEN_AI.GPT_INPUT_ADDED_SUCCESSFULLY,
                data: data
            };
        } catch (error) {
            if (error.code === null || error.code === undefined) {
                error.code = 500;
            }
            return { code: error.code, success: false, data: error.data, message: error.message };
        }
    };

    /**
     * Set gptinput as default
     * @param { number } id - GPT input id
     */
    this.setAsDefaultGTPInput = async function (id) {
        try {
            logStream('debug','Openai Service', 'set As Default GTP Input');
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
                message: MESSAGE.OPEN_AI.GPT_INPUT_SET_AS_DEFAULT_SUCCESSFULLY,
                data: data
            };
        } catch (error) {
            if (error.code === null || error.code === undefined) {
                error.code = 500;
            }
            return { code: error.code, success: false, data: error.data, message: error.message };
        }
    };

    /**
     * Delete chatgpt input
     * @param { number } id - GPT input id
     */
    this.deleteGPTInput = async function (id) {
        try {
            logStream('debug','Openai Service', 'Delete GPT Input');
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
                    message: MESSAGE.OPEN_AI.GPT_INPUT_DELETED_SUCCESSFULLY,
                    data: null
                };
            } else {
                return {
                    code: 200,
                    success: false,
                    message: MESSAGE.OPEN_AI.CANT_DELETE_DEFAULT_GPT_INPUT_NO_GPT_INPUT_WITH_SUCH_ID_EXISTS,
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

    /**
     * Get all ChatGPT models
     */
    this.getGPTModels = async function () {
        try {
            logStream('debug','Openai Service', 'Get GPT Models');
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
                message: MESSAGE.OPEN_AI.LIST_OF_GPT_INPUTS_RETREIVED_SUCCESSFULLY,
                data: response
            };
        } catch (error) {
            if (error.code === null || error.code === undefined) {
                error.code = 500;
            }
            return { code: error.code, success: false, data: error.data, message: error.message };
        }
    };

    /**
     * Add a chatgpt model
     * @param { string } model - Model name
     */
    this.addGPTModel = async function (model) {
        try {
            logStream('debug','Openai Service', 'Add GPT Model');
            const data = await gptmodels.create({
                model
            });
            return {
                code: 200,
                success: true,
                message: MESSAGE.OPEN_AI.GPT_MODEL_ADDED_SUCCESSFULLY,
                data: data
            };
        } catch (error) {
            if (error.code === null || error.code === undefined) {
                error.code = 500;
            }
            return { code: error.code, success: false, data: error.data, message: error.message };
        }
    };

    /**
     * Set gpt model as default
     * @param { number } id - Model id
     */
    this.setAsDefaultGPTModel = async function (id) {
        try {
            logStream('debug','Openai Service', 'Set As Default GPT Model');
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
                message: MESSAGE.OPEN_AI.GPT_MODEL_SET_AS_DEFAULT_SUCCESSFULLY,
                data: data
            };
        } catch (error) {
            if (error.code === null || error.code === undefined) {
                error.code = 500;
            }
            return { code: error.code, success: false, data: error.data, message: error.message };
        }
    };

    /**
     * Delete chatgpt model
     * @param { number } id - Model id
     */
    this.deleteGPTModel = async function (id) {
        try {
            logStream('debug','Openai Service', 'Delete GPT Model');
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
                    message: MESSAGE.OPEN_AI.GPT_MODEL_DELETED_SUCCESSFULLY,
                    data: null
                };
            } else {
                return {
                    code: 200,
                    success: false,
                    message: MESSAGE.OPEN_AI.CANT_DELETE_DEFAULT_GPT_INPUT_NO_GPT_INPUT_WITH_SUCH_ID_EXISTS,
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

    /**
     * Translate excel
     * @param { * } file - Input file
     * @param { string } language - Language into which the translation to be done
     */
    this.translateExcel = async function (file, language) {
        try {
            logStream('debug','Openai Service', 'Translate Excel');
            const data = await readXlsxFile(file.path);
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
                message: MESSAGE.OPEN_AI.CHAT_COMPLETION_CREATED_SUCCESSFULLY,
                data: buffer
            };
        } catch (error) {
            if (error.code === null || error.code === undefined) {
                error.code = 500;
            }
            return { code: error.code, success: false, data: error.data, message: error.message };
        }

    };

    this.getChatGptModels = async function () {
        try {
            const response = await chatgptmodels.findAll({
                where: {
                    id: {
                        [Sequelize.Op.not]: null
                    }
                },
                order: [
                    ['id', 'ASC']
                ],
            });
            return {
                code: 200,
                success: true,
                message: "List of ChatGpt models retreived successfully!",
                data: response
            };
        } catch (error) {
            if (error.code === null || error.code === undefined) {
                error.code = 500;
            }
            return { code: error.code, success: false, data: error.data, message: error.message };
        }
    };

    this.setAsDefaultModelChatGpt = async function (id) {
        try {

            const response = await chatgptmodels.update(
                { isDefault: false },
                {
                    where: {
                        id: {
                            [Sequelize.Op.not]: id
                        }
                    }
                }
            );
            const data = await chatgptmodels.update(
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
                message: "ChatGpt model set as default successfully!",
                data: data
            };
        } catch (error) {
            if (error.code === null || error.code === undefined) {
                error.code = 500;
            }
            return { code: error.code, success: false, data: error.data, message: error.message };
        }
    };

    this.updateChatGptModel = async function (id, temprature, top_p) {
        try {

            const response = await chatgptmodels.update(
                {
                    temprature,
                    top_p
                },
                {
                    where: {
                        id: id
                    }
                }
            );

            return {
                code: 200,
                success: true,
                message: "ChatGpt model updated successfully!",
                data: null
            };
        } catch (error) {
            if (error.code === null || error.code === undefined) {
                error.code = 500;
            }
            return { code: error.code, success: false, data: error.data, message: error.message };
        }
    };

    this.getChatGptPrompts = async function () {
        try {
            const response = await chatgptprompts.findAll({
                where: {
                    id: {
                        [Sequelize.Op.not]: null
                    }
                },
                order: [
                    ['id', 'ASC']
                ],
            });

            const data = {};
            response.forEach(e => {
                data[e.key] = e.value
            });
            
            return {
                code: 200,
                success: true,
                message: "ChatGpt prompts retreived successfully!",
                data: data
            };
        } catch (error) {
            if (error.code === null || error.code === undefined) {
                error.code = 500;
            }
            return { code: error.code, success: false, data: error.data, message: error.message };
        }
    };

    this.updateChatGptPrompts = async function (prompt1, prompt2, prompt3) {
        try {

            const response1 = await chatgptprompts.update(
                {
                    value: prompt1
                },
                {
                    where: {
                        key: 'prompt1'
                    }
                }
            );

            const response2 = await chatgptprompts.update(
                {
                    value: prompt2
                },
                {
                    where: {
                        key: 'prompt2'
                    }
                }
            );

            const response3 = await chatgptprompts.update(
                {
                    value: prompt3
                },
                {
                    where: {
                        key: 'prompt3'
                    }
                }
            );

            return {
                code: 200,
                success: true,
                message: "ChatGpt prompts updated successfully!",
                data: null
            };
        } catch (error) {
            if (error.code === null || error.code === undefined) {
                error.code = 500;
            }
            return { code: error.code, success: false, data: error.data, message: error.message };
        }
    };

    this.getDiagnosisSuggestions = async function (payload) {
        try {
            const prompt = await chatgptprompts.findOne({
                where: {
                    key: 'prompt1'
                }
            });
            let gptInput = prompt.value.replace('[case information]', payload);

            const gptModel = await chatgptmodels.findOne({
                where: {
                    isDefault: true
                }
            });
            const response = await openai.chat.completions.create({
                model: gptModel.model,
                messages: [
                    {
                        role: "user",
                        content: `${gptInput} \nStrictly use below json format to return response:\n { "diagnosis": [{ "name": "<DIAGNOSIS_NAME_HERE>", "description": "<DEATIL_EXPLANATION_FOR_DIAGNOSIS>","rank": "LIKELIHOOD_RANK_HERE" }] }`
                    }
                ],
                temperature: prompt.temperature,
                top_p: gptModel.top_p
            });
            return {
                code: 200,
                success: true,
                message: "Chat completion created successfully!",
                data: response
            };
        } catch (error) {
            if (error.code === null || error.code === undefined) {
                error.code = 500;
            }
            return { code: error.code, success: false, data: error.data, message: error.message };
        }

    };

    this.getUpdatedDiagnosisSuggestions = async function (caseInformation, additionalNotes) {
        try {
            const prompt = await chatgptprompts.findOne({
                where: {
                    key: 'prompt2'
                }
            });
            let gptInput = prompt.value.replace('[case information]', caseInformation).replace('[additional notes]', additionalNotes);

            const gptModel = await chatgptmodels.findOne({
                where: {
                    isDefault: true
                }
            });
            const response = await openai.chat.completions.create({
                model: gptModel.model,
                messages: [
                    {
                        role: "user",
                        content: `${gptInput} \n Strictly use below json format to return response:\n { "diagnosis": [{ "name": "<DIAGNOSIS_NAME_HERE>", "description": "<DEATIL_EXPLANATION_FOR_DIAGNOSIS>","rank": "LIKELIHOOD_RANK_HERE" }] }`
                    }
                ],
                temperature: prompt.temperature,
                top_p: gptModel.top_p
            });
            return {
                code: 200,
                success: true,
                message: "Chat completion created successfully!",
                data: response
            };
        } catch (error) {
            if (error.code === null || error.code === undefined) {
                error.code = 500;
            }
            return { code: error.code, success: false, data: error.data, message: error.message };
        }

    };

    this.getDiagnosticTestAndTreatmentPlan = async function (caseInformation, finalDiagnosis) {
        try {
            const prompt = await chatgptprompts.findOne({
                where: {
                    key: 'prompt3'
                }
            });
            let gptInput = prompt.value.replace('[case information]', caseInformation).replace('[final diagnosis]', finalDiagnosis);

            const gptModel = await chatgptmodels.findOne({
                where: {
                    isDefault: true
                }
            });
            const response = await openai.chat.completions.create({
                model: gptModel.model,
                messages: [
                    {
                        role: "user",
                        content: `${gptInput} \n Strictly use below json format to return response:\n { "diagnostic_tests": [{ "test_name": "<DIAGNOSTIC_TEST_NAME_HERE>", "test_need": "<DIAGNOSTIC_TEST_NEED_AND_DESCRIPTION>"}], treatment_plan: [<TREATMENT_PLAN/MEDICATIONS/ADVICE/ADVICE_FOR_REFERAL>] }`
                    }
                ],
                temperature: prompt.temperature,
                top_p: gptModel.top_p
            });
            return {
                code: 200,
                success: true,
                message: "Chat completion created successfully!",
                data: response
            };
        } catch (error) {
            if (error.code === null || error.code === undefined) {
                error.code = 500;
            }
            return { code: error.code, success: false, data: error.data, message: error.message };
        }

    };

    this.getDiagnosisSuggestions2 = async function (payload) {
        try {
            const prompt = await chatgptprompts.findOne({
                where: {
                    key: 'prompt1'
                }
            });
            let gptInput = prompt.value.replace('[case information]', payload);

            const gptModel = await chatgptmodels.findOne({
                where: {
                    isDefault: true
                }
            });
            const response = await openai.chat.completions.create({
                model: gptModel.model,
                messages: [
                    {
                        role: "user",
                        content: `${gptInput}`
                    }
                ],
                temperature: prompt.temperature,
                top_p: gptModel.top_p
            });
            return {
                code: 200,
                success: true,
                message: "Chat completion created successfully!",
                data: response
            };
        } catch (error) {
            if (error.code === null || error.code === undefined) {
                error.code = 500;
            }
            return { code: error.code, success: false, data: error.data, message: error.message };
        }

    };

    this.getUpdatedDiagnosisSuggestions2 = async function (caseInformation, additionalNotes) {
        try {
            const prompt = await chatgptprompts.findOne({
                where: {
                    key: 'prompt2'
                }
            });
            let gptInput = prompt.value.replace('[case information]', caseInformation).replace('[additional notes]', additionalNotes);

            const gptModel = await chatgptmodels.findOne({
                where: {
                    isDefault: true
                }
            });
            const response = await openai.chat.completions.create({
                model: gptModel.model,
                messages: [
                    {
                        role: "user",
                        content: `${gptInput}`
                    }
                ],
                temperature: prompt.temperature,
                top_p: gptModel.top_p
            });
            return {
                code: 200,
                success: true,
                message: "Chat completion created successfully!",
                data: response
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