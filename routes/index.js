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

router.get('/mindmap', (req, res) => {
  try {
    const contents = JSON.parse(fs.readFileSync(`./public/license/license.json`));
      res.status(200).json({
        message:'MindMap license Keys',
        data: contents
      });
    } catch (error) {
    res.status(400).json({
      message:'Cannot read file!',
      error
    })
  }
})



router.get('/mindmap/download', (req, res) => {
  let contents, mindmaps, path, flag = false;
  const key = req.query.key;
  if (key) {
    rmDir('./public/key');
    new Promise((resolve, reject) => {
      contents = JSON.parse(fs.readFileSync(`./public/license/license.json`));
      contents.licensekey.forEach(license => {
        if (Object.keys(license) == key) {
          flag = true;
          mindmaps = Object.values(license)[0];
        }
      });
      if (flag) resolve(true)
      else reject()
    }).then(()=> {
        mkDir('./public/key');
        mkDir('./public/key/engine');
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
      }).catch(() => { res.status(200).json({message:'Key is invalid'}) })
  } else {
    res.status(200).json({
      message:'Please add key to Query'
    })
  }
});



router.post('/mindmap/upload', (req, res) => {
  const key = req.body.key;
  const filename = req.body.filename;
  const value = req.body.value;
  var flag = true;
  if (key) {
    try {
      const contents = JSON.parse(fs.readFileSync(`./public/license/license.json`));
      contents.licensekey.forEach((license, index) => {
        if (Object.keys(license) == key) {
          contents.licensekey[index][key].push(filename);
          flag = false;
        }
      });
      if (flag) {
      contents.licensekey.push({[key]:[filename]})
      }
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
        message: 'Cannot read file!',
        error
      })
    }
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
  readFiles('./public/key1/');
  res.status(200).json({message : 'sucess'});
})


module.exports = router;