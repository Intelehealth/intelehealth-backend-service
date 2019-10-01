const express = require('express');
const router = express.Router();
const fs = require("fs");
const mysql = require('../public/javascripts/mysql/mysql');
const zipFile = require('../public/javascripts/zip');
const deleteFile = require('../public/javascripts/deletefile');
const mkdir = require('../public/javascripts/directory');


router.get('/mindmap', (req, res) => {
  try {
    const contents = JSON.parse(fs.readFileSync(`./public/license/license.json`));
      const data = []
      contents.licensekey.forEach(license => {
      data.push(Object.keys(license)[0])
      })
      res.status(200).json({
        message:'MindMap license Keys',
        data
      });
    } catch (error) {
    res.status(400).json({
      message:'Cannot read file!',
      error
    })
  }
})



router.get('/mindmap/download', (req, res) => {
  const key = req.query.key;
  if (key) {
    deleteFile.rmDir('./public/key')
    mkdir.mkDir('./public/key');
    try {
      const contents = JSON.parse(fs.readFileSync(`./public/license/license.json`));
      contents.licensekey.forEach(license => {
        if (Object.keys(license) == key) {
          const mindmaps = Object.values(license)[0];
          mindmaps.forEach((mindmap, index) => {
            mysql.query(`Select mindmap_json from mindmaps where mindmap_name='${mindmap}'`, (err, result) => {
              if (err) res.status(400).json({message: err.message})
              else {
                let path = `./public/key/${mindmap}`;
                fs.writeFileSync(path, result[0].mindmap_json);
                if (mindmaps.length === index+1) send();
              }
            })
          })
          send = () => {
            let zip = zipFile.zip(key)
            zip.then(() => {
              let mindmapPath = `http://localhost:3000/${key}.zip`;
              deleteFile.rmDir('./public/key');
              res.status(200).json({message:'Success', mindmap: mindmapPath});
            },(error) => res.status(400).json({message:'Failed to create zip', error}))
          }
        }
      });
    } catch (error) {
      res.status(400).json({
        message:'Cannot read file!',
        error
      })
    }
  } else {
    res.status(500).json({
      message:'Please add key to Query'
    })
  }
});



router.post('/mindmap/upload', (req, res) => {
  const key = req.body.key;
  const value = req.body.value;
  var flag = true;
  if (key) {
    try {
      const contents = JSON.parse(fs.readFileSync(`./public/license/license.json`));
      contents.licensekey.forEach((license, index) => {
        if (Object.keys(license) == key) {
          contents.licensekey[index][key].push(value);
          flag = false;
        }
      });
      if (flag) {
      contents.licensekey.push({[key]:[value]})
      }
      try {
        fs.writeFile('./public/license/license.json', JSON.stringify(contents), 'utf8', (err) => {
          if(err) return console.error(err);
          else {
            res.status(200).json({
            message:'Uploaded Successfully'
            });
          }
        })
      } catch (error) {
          res.status(500).json({
            message: 'Cannot write to file!',
            error
          })
        }
    } catch (error) {
      res.status(500).json({
        message: 'Cannot read file!',
        error
      })
    }
  }
})


module.exports = router;