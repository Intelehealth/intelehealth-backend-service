const fs = require("fs");
const url = require('url');

getFormattedUrl = (req) => {
  return url.format({
      protocol: req.protocol,
      host: req.get('host')
  });
}

readLicenseFile = (contents, key) => {
    let flag = true;
    return new Promise((resolve, reject) => {
    contents.licensekey.forEach((license, index) => {
      if (key in license) {
        flag = false
        resolve({present: true, index})
      }
    })
    if (flag) {
      resolve({present: false})
    }
    })
}

writeToLicenseKey = (contents) => {
    return new Promise((resolve, reject) => {
      try {
        fs.writeFile('./public/license/license.json', JSON.stringify(contents), 'utf8', (err) => {
          if(err) reject({message: err.message});
          else {
            resolve()
          }
        })
      } catch (error) {
        reject()
      }
    })
  }

module.exports = { getFormattedUrl, readLicenseFile, writeToLicenseKey }