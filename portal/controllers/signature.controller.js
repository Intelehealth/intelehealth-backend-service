const {
    _createSign,
    _uploadSign
} = require("../services/signature.service");
const { validateParams, RES } = require("../handlers/helper");
const Constant = require("../constants/constant");
const { MESSAGE } = require("../constants/messages");
const { logStream } = require("../logger/index");

module.exports = (function () {
    /**
     * Request for create signature.
     * @param {request} req
     * @param {response} res
     */
    this.createSign = async (req, res) => {
        try {
            logStream('debug', 'API call', 'Create Sign');
            const {
                textOfSign,
                fontName,
                providerId
            } = req.body;
            const keysAndTypeToCheck = [
                { key: Constant.TEXT_OF_SIGN, type: "string" },
                { key: Constant.FONT_NAME, type: "string" },
                { key: Constant.PROVIDER_ID, type: "string" }
            ];
            if (validateParams(req.body, keysAndTypeToCheck)) {
                const data = await _createSign(textOfSign, fontName, providerId);
                logStream('debug', 'Success', 'Create Sign');
                RES(
                    res,
                    {
                        success: true,
                        message: MESSAGE.SIGNATURE.SIGNATURE_CREATED_SUCCESSFULLY,
                        data
                    },
                    200
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
     * Request for upload the signature.
     * @param {request} req
     * @param {response} res
     */
    this.uploadSign = async (req, res) => {
        try {
            logStream('debug', 'API call', 'Upload Sign');
            const {
                file,
                providerid
            } = req.body;
            const keysAndTypeToCheck = [
                { key: Constant.FILE, type: "string" },
                { key: Constant.PROVIDER_ID, type: "string" }
            ];
            if (validateParams(req.body, keysAndTypeToCheck)) {
                const data = await _uploadSign(file, providerid);
                logStream('debug', 'Success', 'Upload Sign');
                RES(
                    res,
                    {
                        success: true,
                        message: MESSAGE.SIGNATURE.SIGNATURE_UPLOADED_SUCCESSFULLY,
                        data
                    },
                    200
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