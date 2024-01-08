const fs = require('fs');

module.exports = {

    /**
     * Create directory at the specified path
     * @param { string } - path
     */
    mkDir: (directory) => {
        try {
            fs.statSync(directory);
            console.log('folder exist')
        } catch (e) {
            fs.mkdirSync(directory);
            console.log('folder created')
        }
    }
}