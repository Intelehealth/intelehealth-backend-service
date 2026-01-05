const fs = require("fs");

module.exports = {
    /**
     * Write mindmap
     * @param { string } mindmap - Mindmap contents
     * @param {*} result - content
     */
    wrMindmap: (mindmap, result) => {
        if (mindmap.match('famHist') || mindmap.match('patHist') || mindmap.match('physExam') || mindmap.match('config') !== null || mindmap.match('state_district_tehsil') !== null) {
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