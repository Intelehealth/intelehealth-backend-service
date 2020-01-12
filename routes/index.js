const express = require('express');
const router = express.Router();
const fs = require("fs");
const url = require('url');
const mysql = require('../public/javascripts/mysql/mysql');
const { zipFolder } = require('../public/javascripts/zip');
const { rmDir } = require('../public/javascripts/deletefile');
const { mkDir } = require('../public/javascripts/directory');
const { wrMindmap } = require('../public/javascripts/writefile');

const getFormattedUrl = (req) => {
  return url.format({
      protocol: req.protocol,
      host: req.get('host')
  });
}

// mindmap upload
router.post('/mindmap/upload', (req, res) => {
  const key = req.body.key;
  const filename = req.body.filename;
  const value = req.body.value;
  if (key) {
    try {
      const contents = JSON.parse(fs.readFileSync(`./public/license/license.json`));
      contents.licensekey.forEach((license, index) => {
        if (key in license) {
          contents.licensekey[index][key].key.push(filename);
        }
      });
      try {
        fs.writeFile('./public/license/license.json', JSON.stringify(contents), 'utf8', (err) => {
          if(err) res.status(400).json({message: err.message});
          else {
          let details = { 
            mindmap_name : filename,
            date_created : new Date(),
            mindmap_json : value
          };
          mysql.query('Insert into mindmaps SET ?', details, (err, results, fields) => {
            if (err) res.status(400).json({message: err.message})
            else {
            res.status(200).json({
              message:'Uploaded Successfully'
              });
            }
          });
          }
        })
      } catch (error) {
          res.status(200).json({
            message: 'Cannot write to file!',
            error
          })
        }
    } catch (error) {
      res.status(200).json({
        message: 'Unable to read file, please check the format!',
        error
      })
    }
  } else {
    res.status(200).json({
      message: 'Please provide a license key'
    })
  }
})

// list of mindmap keys
router.get('/mindmap', (req, res) => {
  try {
    const contents = JSON.parse(fs.readFileSync(`./public/license/license.json`));
      res.status(200).json({
        message:'MindMap license Keys',
        data: contents
      });
    } catch (error) {
    res.status(400).json({
      message:'Cannot find mindmaps. Please contact system administration!',
      error
    })
  }
})

// read file
const readLicenseFile = (contents, key) => {
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


// write to license key file
const writeToLicenseKey = (contents) => {
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
// Add new license key
router.post('/mindmap/addkey', (req, res) => {
  let newKey = req.body.key;
  let newExpiryDate = req.body.expiryDate
  if (newKey) {
    let contents = JSON.parse(fs.readFileSync(`./public/license/license.json`));
    readLicenseFile(contents, newKey)
    .then(response => {
      if (response.present) {
        res.status(200).json({message: 'Key already Present'})
      } else {
        contents.licensekey.push({[newKey]:[], expiry_date: newExpiryDate})
        writeToLicenseKey(contents)
        .then(() => res.status(200).json({message: 'Key added'}))
        .catch(() => res.status(200).json({message: 'Cannot write to file!',error}))
      }
    }).catch(() => {} )
  } else {
    res.status(200).json({
      message:'Please enter a new licence key'
    })
  }
})

// list of mindmap and logos
router.get('/mindmap/details/:key', (req, res) => {
  let lists = [], contents, image = {};
  let key = req.params.key;
  if (key) {
    new Promise((resolve, reject) => {
      contents = JSON.parse(fs.readFileSync(`./public/license/license.json`));
      contents.licensekey.forEach(license => {
        if (key in license) {
          resolve({
            mindmaps: Object.values(license)[0].key,
            expiry: Object.values(license)[0].expiry_date
          })
        }
      });
    }).then(response => {
      const expiry = response.expiry;
      const mindmaps = response.mindmaps;
      mindmaps.forEach((mindmap, index) => {
      mysql.query(`Select * from mindmaps where mindmap_name='${mindmap}'`, (err, result) => {
        if (err) res.status(400).json({message: err.message})
        else {
          let minmapName = result[0].mindmap_name;
          if (minmapName.match('.json') !== null) {
            const data = {
              name: result[0].mindmap_name,
              last_update : result[0].date_updated ? result[0].date_updated : result[0].date_created
            }
            lists.push(data);
            if (mindmaps.length === index+1) send();
          } else {
            image = {
              image_name: result[0].mindmap_name,
              image_file: result[0].mindmap_json
            }
            if (mindmaps.length === index+1) send();
          }
        }
      })
    })
    send = () => {
      res.status(200).json({
        expiry,
        datas: lists,
        image
      })
    }
  }).catch(err => console.log(err))
  } else {
    res.status(200).json({
      message:'Please enter a licence key'
    })
  }
})

//  Expiry Date Update
router.post('/mindmap/:key', (req, res) => {
  const key = req.params.key;
  const newExpiryDate = req.body.newExpiryDate;
  if (key) {
    const contents = JSON.parse(fs.readFileSync(`./public/license/license.json`));
      contents.licensekey.forEach((license, index) => {
        if (key in license) {
          contents.licensekey[index][key].expiry_date = newExpiryDate;
          try {
            fs.writeFile('./public/license/license.json', JSON.stringify(contents), 'utf8', (err) => {
              if(err) res.status(400).json({message: err.message});
              else {
                res.status(200).json({
                  message: 'Expiry date updated',
                  updatedDate : newExpiryDate
                })
              }
            })
          } catch (error) {
            res.status(200).json({
              message: 'Cannot write to file!',
              error
            })
          }
        }
      })
  } else {
    res.status(200).json({
      message: 'Please enter a licence key'
    })
  }
})

// Delete mindmap
router.post('/mindmap/delete/:key', (req, res) => {
  let key = req.params.key;
  let filename = req.body.mindmapName;
  const contents = JSON.parse(fs.readFileSync(`./public/license/license.json`));
  readLicenseFile(contents, key).then(response => {
    let fileIndex = contents.licensekey[response.index][key].key.indexOf(filename);
    if (fileIndex !== -1) {
      mysql.query(`DELETE from mindmaps where mindmap_name='${filename}'`, (err, result) => {
        if (err) res.status(400).json({err})
        else {
          contents.licensekey[response.index][key].key.splice(fileIndex, 1);
          writeToLicenseKey(contents)
          .then(()=> res.status(200).json({message: 'File Deleted', fileIndex}))
          .catch((err) => res.status(400).json({message: 'Cannot write to file!', err}))
        }
      })
    }
  })
})


// download mindmap and logos
router.get('/mindmap/download', (req, res) => {
  let contents;
  const key = req.query.key;
  if (key) {
    rmDir('./public/key');
    new Promise((resolve, reject) => {
      contents = JSON.parse(fs.readFileSync(`./public/license/license.json`));
      contents.licensekey.forEach(license => {
        if (key in license) {
          resolve({
            mindmaps: Object.values(license)[0].key,
            expiry: Object.values(license)[0].expiry_date
          })
        }
      });
    }).then(response => {
      const mindmaps = response.mindmaps;
      const expiry = response.expiry;
        mkDir('./public/key');
        mkDir('./public/key/Engines');
        mkDir('./public/key/logo');
        mindmaps.forEach((mindmap, index) => {
          mysql.query(`Select mindmap_json from mindmaps where mindmap_name='${mindmap}'`, (err, result) => {
            if (err) res.status(400).json({message: err.message})
            else {
              wrMindmap(mindmap, result[0].mindmap_json)
              if (mindmaps.length === index+1) send();
            }
          })
        })
        send = () => {
          let zip = zipFolder(key)
          zip.then(() => {
            let host = getFormattedUrl(req);
            let mindmapPath = `${host}/${key}.zip`;
            rmDir('./public/key');
            res.status(200).json({message:'Success', mindmap: mindmapPath});
          },(error) => res.status(400).json({message:'Failed to create zip', error}))
        }
      }).catch(() => { res.status(200).json({message:'Licence Key is invalid'}) })
  } else {
    res.status(200).json({
      message:'Please enter a licence key'
    })
  }
});

// logo update
router.put('/mindmap/:key/:imagename', (req, res) => {
  const key = req.params.key;
  const oldfileName = req.params.imagename;
  const newfilename = req.body.filename;
  const value = req.body.value;
  if (key && oldfileName) {
    const contents = JSON.parse(fs.readFileSync(`./public/license/license.json`));
    contents.licensekey.forEach((license, index) => {
      if (key in license) {
        var fileIndex = contents.licensekey[index][key].key.indexOf(oldfileName);
        if (fileIndex !== -1) {
          try {
            mysql.query(`Select * from mindmaps where mindmap_name='${oldfileName}'`, (err, results, fields) => {
              if (err) res.status(400).json({message: err.message})
              else {
                let fileSqlId = results[0].mindmap_id;
                mysql.query(`UPDATE mindmaps SET mindmap_name='${newfilename}', mindmap_json='${value}', date_updated='${new Date().toISOString().slice(0, 19).replace('T', ' ')}' WHERE mindmap_id=${fileSqlId}`, (err, results) => {
                  if (err) res.status(400).json({message: err.message})
                  else {
                    contents.licensekey[index][key].key[fileIndex] = newfilename;
                    fs.writeFile('./public/license/license.json', JSON.stringify(contents), 'utf8', (err) => {
                      if(err) res.status(400).json({message: err.message});
                      else {
                        res.status(200).json({
                          message: 'Image Updated'
                        })
                      }
                    })
                  }
                })
              }
            });
          } catch (error) {
            res.status(200).json({
              message: 'Cannot write to file!',
              error
            })
          }
        }
      }
    });
  } else {
    res.status(200).json({
      message: 'Please provide a license key'
    })
  }
})


const readFiles = (dirname) => {
    fs.readdir(dirname, (err, filenames) => {
    filenames.forEach(filename => {
      let file = JSON.parse(fs.readFileSync(dirname + filename));
      let details = { 
         mindmap_name : filename,
         date_created : new Date(),
         mindmap_json : JSON.stringify(file)
       };
      mysql.query('Insert into mindmaps SET ?', details, (err, results, fields) => {
        if (err) res.status(400).json({message: err.message})
      })
    });
  });
}

router.get('/read', (req, res, next) => {
  readFiles('./public/afimm_2017/');
  res.status(200).json({message : 'sucess'});
})


module.exports = router;