const fs = require('fs');
const archiver = require('archiver');

module.exports = {
    /**
     * Zip folder
     * @param { string } key - zip name
     */
    zipFolder : (key) => {
        const archive = archiver.create('zip', {});
        const output = fs.createWriteStream(`./public/${key}.zip`);
        return new Promise((resolve, reject) => {
            archive
                .directory('./public/key', false)
                .on('error', err => reject(err))
                .pipe(output);

            output.on('close', () => {
                resolve();
                console.log(archive.pointer() + ' total bytes');
            });
            archive.finalize();
        })
    }
}