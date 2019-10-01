const fs = require('fs');
const archiver = require('archiver');

module.exports = {
    zip : (key) => {
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