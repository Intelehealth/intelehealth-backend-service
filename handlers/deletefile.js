const fs = require('fs')

const rmFile = (dirPath) => {
  let files = fs.readdirSync(dirPath); 
  if (files.length > 0)
    for (const element of files) {
      const filePath = dirPath + '/' + element;
      if (fs.statSync(filePath).isFile())
        fs.unlinkSync(filePath);
      else
        rmDir(filePath);
    }
}

const rmDir = (path) => {
  if (fs.existsSync(path)) {
    fs.readdirSync(path).forEach(file => {
      const curPath = path + "/" + file;
      if (fs.lstatSync(curPath).isDirectory()) { // recurse
        rmDir(curPath);
      } else { // delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(path);
  }
}

module.exports = { rmFile, rmDir }