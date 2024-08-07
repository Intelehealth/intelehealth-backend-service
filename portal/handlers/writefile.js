const fs = require("fs");

const KEY_FILES = [
  "famHist.json",
  "patHist.json",
  "physExam.json",
  "config.json",
  "state_district_tehsil.json",
];

module.exports = {
    /**
     * Write mindmap
     * @param { string } mindmap - Mindmap contents
     * @param {*} result - content
     */
    wrMindmap: (mindmap, result) => {
        if (KEY_FILES.includes(mindmap)) {
            path = `./public/key/${mindmap}`;
            fs.writeFileSync(path, result);
        }
        else if (mindmap.match('.png') || mindmap.match('.jpg') || mindmap.match('jpeg') !== null) {
            const ImageURL = result
            const base64Image = ImageURL.split(';base64,').pop();
            path = `./public/key/logo/${mindmap}`;
            fs.writeFileSync(path, base64Image, { encoding: 'base64' });
        } else {
            path = `./public/key/Engines/${mindmap}`;
            fs.writeFileSync(path, result);
        }
    }
}