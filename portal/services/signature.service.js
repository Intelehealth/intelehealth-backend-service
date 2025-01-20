const path = require("path");
const fs = require("fs");
const { logStream } = require("../logger/index");

const {createCanvas, registerFont } = require('canvas'); // Import canvas functions

// Function to generate an image from text using canvas
const generateTextImage = async (text, options) => {
  try {
    const { fontPath, fontFamily, verticalAlign, maxWidth, fontSize, textAlign, lineHeight, customHeight } = options;
    // Load the font
    registerFont(fontPath, { family: fontFamily });
    // Create a canvas with a max width and enough height to accommodate the text
    const canvas = createCanvas(maxWidth, customHeight || 200); // Custom height can be set based on the line height
    const ctx = canvas.getContext('2d');

    
    ctx.font = `${fontSize}px ${fontFamily}`;

    // Set the text alignment properties
    ctx.textAlign = textAlign || 'center';
    ctx.textBaseline = verticalAlign || 'middle';

    // Set the line height for multiline text
    const lines = text.split('\n');
    let y = customHeight / 2; // Start in the vertical middle
    let x = maxWidth / 2; // Start in the horizontal middle

    // Draw each line of text with the specified line height
    lines.forEach((line) => {
      ctx.fillText(line, x, y);
      y += lineHeight; // Increment y for the next line
    });

    // Convert canvas to a Data URL (Base64 string)
    const dataUri = canvas.toDataURL('image/png');

    return dataUri;
  } catch (error) {
    console.error('Error generating text image:', error);
    throw error;
  }
};


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

            const dataUri = await generateTextImage(textOfSign, {
                fontPath: path.join(...[__dirname, '../', 'fonts', fontPath]),
                fontFamily: fontFamily,
                verticalAlign: 'middle',
                maxWidth,
                fontSize,
                textAlign: 'center',
                lineHeight,
                customHeight
            });
            fs.writeFileSync(path.join(...['/var', 'www', 'html', 'docsign',`${providerId}_sign.png`]), dataUri.replace('data:image/png;base64,',''),'base64');
            logStream('debug','Signature Created', 'Create Sign');
            return { url: `http://${process.env.DOMAIN}/ds/${providerId}_sign.png` };
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
            return { url: `http://${process.env.DOMAIN}/ds/${providerid}_sign.png` };
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