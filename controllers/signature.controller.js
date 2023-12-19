const {
    _createSign,
    _uploadSign
} = require("../services/signature.service");
const { validateParams, RES } = require("../handlers/helper");
const Constant = require("../constants/constant");

module.exports = (function () {
    this.createSign = async (req, res) => {
        try {
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
                RES(
                    res,
                    {
                        success: true,
                        message: "Signature created successfully!",
                        data
                    },
                    200
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

    this.uploadSign = async (req, res) => {
        try {
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
                RES(
                    res,
                    {
                        success: true,
                        message: "Signature uploaded successfully!",
                        data
                    },
                    200
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