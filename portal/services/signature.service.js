const textToImage = require('text-to-image');
const path = require("path");
const fs = require("fs");
const { logStream } = require("../logger/index");

module.exports = (function () {
    /**
     * Create signature for a given provider with specified font and text
     * @param { string } textOfSign - Signature text
     * @param { string } fontName - Font name
     * @param { string } providerId - Provider uuid
     */
    this._createSign = async (textOfSign, fontName, providerId) => {
        try {
            logStream('debug','Signature Service', 'Create Sign');
            let fontFamily = '';
            let fontPath = '';
            let maxWidth = 300;
            let fontSize = 50;
            let lineHeight = 80;
            let customHeight = 100;
            switch (fontName) {
                case 'Almondita':
                    fontFamily = 'Almondita';
                    fontPath = 'Almondita.ttf';
                    fontSize = 60;
                    lineHeight = 100;
                    break;
                case 'Arty':
                    fontFamily = 'Arty Signature';
                    fontPath = 'Arty.otf';
                    fontSize = 80;
                    lineHeight = 120;
                    customHeight = 120;
                    break;
                case 'Asem':
                    fontFamily = 'Asem Kandis';
                    fontPath = 'Asem.otf';
                    maxWidth = 400;
                    break;
                case 'Youthness':
                    fontFamily = 'Youthness Regular';
                    fontPath = 'Youthness.ttf';
                    break;
            }
            const dataUri = textToImage.generateSync(textOfSign, {
                fontPath: path.join(...[__dirname, '../', 'fonts', fontPath]),
                fontFamily: fontFamily,
                verticalAlign: 'center',
                maxWidth,
                fontSize,
                textAlign: 'center',
                lineHeight,
                customHeight
            });
            fs.writeFileSync(path.join(...['/var', 'www', 'html', 'docsign',`${providerId}_sign.png`]), dataUri.replace('data:image/png;base64,',''),'base64');
            logStream('debug','Signature Created', 'Create Sign');
            return { url: `https://${process.env.DOMAIN}/ds/${providerId}_sign.png` };
        } catch (error) {
            logStream("error", error.message);
            if (error.code === null || error.code === undefined) {
                error.code = 500;
            }
            return { success: false, data: error.data, message: error.message };
        }
    };

    /**
     * Upload provider signature
     * @param { * } file - Signature file
     * @param { string } providerId - Provider uuid
     */
    this._uploadSign = async (file, providerid) => {
        try {
            logStream('debug','Signature Service', 'Upload Sign');
            fs.writeFileSync(path.join(...['/var', 'www', 'html', 'docsign',`${providerid}_sign.png`]), file.replace('data:image/png;base64,',''),'base64');  
            logStream('debug','Signature Uploaded', 'Upload Sign');
            return { url: `https://${process.env.DOMAIN}/ds/${providerid}_sign.png` };
        } catch (error) {
            logStream("error", error.message);
            if (error.code === null || error.code === undefined) {
                error.code = 500;
            }
            return { success: false, data: error.data, message: error.message };
        }
    };
    return this;
})();