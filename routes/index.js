const express = require('express');
const router = express.Router();
const fs = require("fs");
const mysql = require('../public/javascripts/mysql/mysql');
const { zipFolder } = require('../public/javascripts/zip');
const { rmDir } = require('../public/javascripts/deletefile');
const { mkDir } = require('../public/javascripts/directory');
const { wrMindmap } = require('../public/javascripts/writefile');
const { getFormattedUrl, readLicenseFile, writeToLicenseKey } = require('../public/javascripts/functions');

router.post('/mindmap/upload', async(req, res) => {
    try {
        const key = req.body.key;
        const filename = req.body.filename;
        const value = req.body.value;
        if (key) {

            const contents = JSON.parse(fs.readFileSync(`./public/license/license.json`));
            readLicenseFile(contents, key).then(response => {
                if (response.present) {
                    let filePresent = contents.licensekey[response.index][key].key.includes(filename);
                    let details = {
                        mindmap_name: filename,
                        date_created: new Date(),
                        mindmap_json: value,
                        licensekey_name: key
                    };
                    if (!filePresent) {
                        contents.licensekey[response.index][key].key.push(filename);
                        writeToLicenseKey(contents)
                            .then(() => {
                                mysql.query(`Select * from mindmaps where mindmap_name='${filename}' and licensekey_name='${key}'`, (err, results) => {
                                    if (err) {
                                        res.status(400).json(({ message: err.message }))
                                    } else {
                                        if (!results.length) {
                                            mysql.query('Insert into mindmaps SET ?', details, (err, results, fields) => {
                                                console.log('results: ', results);
                                                console.log('err: ', err);
                                                if (err) res.status(400).json({ message: err.message })
                                                else res.status(200).json({ message: 'Uploaded Successfully' });
                                            });
                                        } else {
                                            mysql.query(`UPDATE mindmaps SET mindmap_json=QUOTE('${value}') WHERE mindmap_name='${filename}' and  licensekey_name='${key}'`, (err, results, fields) => {
                                                if (err) res.status(400).json({ message: err.message })
                                                else res.status(200).json({ message: 'Updated Successfully' });
                                            });
                                        }
                                    }
                                })
                            }).catch((error) => res.status(200).json({ message: 'Cannot write to file!', error }))
                    } else {
                        const updateJSON = `UPDATE mindmaps SET mindmap_json=QUOTE('${value}') WHERE mindmap_name='${filename}' and  licensekey_name='${key}'`
                        mysql.query(updateJSON, (err, results, fields) => {
                            if (err) res.status(400).json({ message: err.message })
                            else res.status(200).json({ message: 'File Updated Successfully' });
                        });
                    }
                }
            });
        } else res.status(200).json({ message: 'Please provide a license key' })
    } catch (error) {
        console.log('error: ', error);
    }
})

// list of mindmap keys
router.get('/mindmap', (req, res) => {
    try {
        const contents = JSON.parse(fs.readFileSync(`./public/license/license.json`));
        res.status(200).json({
            message: 'MindMap license Keys',
            data: contents
        });
    } catch (error) {
        res.status(400).json({
            message: 'Cannot find mindmaps. Please contact system administration!',
            error
        })
    }
})

// post image
router.post('/mindmap/image', (req, res) => {
    const key = req.body.key;
    const filename = req.body.filename;
    const value = req.body.value;
    if (key) {
        try {
            let details = {
                mindmap_name: filename,
                date_created: new Date(),
                mindmap_json: value
            };
            mysql.query('Insert into mindmaps SET ?', details, (err, results, fields) => {
                if (err) res.status(400).json({ message: err.message })
                else {
                    const contents = JSON.parse(fs.readFileSync(`./public/license/license.json`));
                    readLicenseFile(contents, key).then(response => {
                        if (response.present)
                            contents.licensekey[response.index][key].key.push(filename);
                        writeToLicenseKey(contents)
                            .then(() => res.status(200).json({ message: 'Image Uploaded' }))
                            .catch((err) => res.status(400).json({ message: 'Cannot write to file!', err }))
                    })
                }
            });
        } catch (error) {
            res.status(200).json({
                message: 'Cannot write to file!',
                error
            })
        }
    } else {
        res.status(200).json({
            message: 'Please provide a license key'
        })
    }
});

// Add new license key
router.post('/mindmap/addkey', (req, res) => {
    let newKey = req.body.key;
    let newExpiryDate = req.body.expiryDate
    if (newKey) {
        let contents = JSON.parse(fs.readFileSync(`./public/license/license.json`));
        readLicenseFile(contents, newKey)
            .then(response => {
                if (response.present) {
                    res.status(200).json({ message: 'Key already Present' })
                } else {
                    contents.licensekey.push({
                        [newKey]: { key: [], expiry_date: newExpiryDate }
                    })
                    writeToLicenseKey(contents)
                        .then(() => res.status(200).json({ message: 'Key added' }))
                        .catch(() => res.status(200).json({ message: 'Cannot write to file!', error }))
                }
            }).catch(() => {})
    } else {
        res.status(200).json({
            message: 'Please enter a new licence key'
        })
    }
})


router.get('/mindmap/details/:key', (req, res) => {
    let lists = [],
        contents, image = {};
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
            if (mindmaps.length) {
                mindmaps.forEach((mindmap, index) => {
                    mysql.query(`Select * from mindmaps where mindmap_name='${mindmap}' and licensekey_name='${key}'`, (err, result) => {
                        if (err) res.status(400).json({ message: err.message })
                        else {
                            let minmapName = result[0].mindmap_name;
                            if (minmapName.match('.json') !== null) {
                                const data = {
                                    name: result[0].mindmap_name,
                                    last_update: result[0].date_updated ? result[0].date_updated : result[0].date_created
                                }
                                lists.push(data);
                                if (mindmaps.length === index + 1) send();
                            } else {
                                image = {
                                    image_name: result[0].mindmap_name,
                                    image_file: result[0].mindmap_json
                                }
                                if (mindmaps.length === index + 1) send();
                            }
                        }
                    })
                })
            } else {
                res.status(200).json({
                    expiry,
                    data: 'No mindmaps to this licence key'
                })
            }
            send = () => {
                res.status(200).json({
                    expiry,
                    datas: lists,
                    image: Object.keys(image).length ? image : undefined
                })
            }
        }).catch(err => console.log(err))
    } else {
        res.status(200).json({
            message: 'Please enter a licence key'
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
                writeToLicenseKey(contents)
                    .then(() => res.status(200).json({ message: 'Expiry date updated', updatedDate: newExpiryDate }))
                    .catch(() => res.status(400).json({ message: 'Cannot write to file!' }))
            }
        })
    } else {
        res.status(200).json({
            message: 'Please enter a licence key'
        })
    }
})


router.post('/mindmap/delete/:key', (req, res) => {
    let key = req.params.key;
    let filename = req.body.mindmapName;
    const contents = JSON.parse(fs.readFileSync(`./public/license/license.json`));
    readLicenseFile(contents, key).then(response => {
        let fileIndex = contents.licensekey[response.index][key].key.indexOf(filename);
        if (fileIndex !== -1) {
            contents.licensekey[response.index][key].key.splice(fileIndex, 1);
            let fileExitOnOtherKey = contents.licensekey.filter(item => { return Object.values(item)[0].key.includes(req.body.mindmapName) })
                // if (fileExitOnOtherKey.length) {
                //     writeToLicenseKey(contents)
                //         .then(() => res.status(200).json({ message: 'File Deleted', fileIndex }))
                //         .catch((err) => res.status(400).json({ message: 'Cannot write to file!', err }))
                // } else {
            mysql.query(`DELETE from mindmaps where mindmap_name='${filename}' and licensekey_name='${key}'`, (err, result) => {
                    if (err) res.status(400).json({ err })
                    else {
                        writeToLicenseKey(contents)
                            .then(() => res.status(200).json({ message: 'File Deleted', fileIndex }))
                            .catch((err) => res.status(400).json({ message: 'Cannot write to file!', err }))
                    }
                })
                // }
        }
    })
})


router.get('/mindmap/download', (req, res) => {
    let contents;
    const key = req.query.key;
    if (key) {
        rmDir('./public/key');
        new Promise((resolve, reject) => {
            contents = JSON.parse(fs.readFileSync(`./public/license/license.json`));
            contents.licensekey.forEach((license, index) => {
                if (key in license) {
                    resolve({
                        mindmaps: Object.values(license)[0].key,
                        expiry: Object.values(license)[0].expiry_date
                    })
                }
                if (contents.licensekey.length === index + 1) reject()
            });
        }).then(response => {
            const mindmaps = response.mindmaps;
            const expiryDate = new Date(response.expiry).getTime();
            const currentDate = new Date().getTime();
            if (expiryDate > currentDate) {
                mkDir('./public/key');
                mkDir('./public/key/Engines');
                mkDir('./public/key/logo');
                mindmaps.forEach((mindmap, index) => {
                    mysql.query(`Select mindmap_json from mindmaps where mindmap_name='${mindmap}' and licensekey_name='${key}' `, (err, result) => {
                        if (err) res.status(400).json({ message: err.message })
                        else {
                            wrMindmap(mindmap, result[0].mindmap_json)
                            if (mindmaps.length === index + 1) send();
                        }
                    })
                })
            } else {
                res.status(200).json({ message: 'License Expired' })
            }
            send = () => {
                let zip = zipFolder(key)
                zip.then(() => {
                    let host = getFormattedUrl(req);
                    let mindmapPath = `${host}/${key}.zip`;
                    rmDir('./public/key');
                    res.status(200).json({ message: 'Success', mindmap: mindmapPath });
                }, (error) => res.status(400).json({ message: 'Failed to create zip', error }))
            }
        }).catch(() => { res.status(200).json({ message: 'Licence Key is invalid' }) })
    } else {
        res.status(200).json({
            message: 'Please enter a licence key'
        })
    }
});

router.put('/mindmap/:key/:imagename', (req, res) => {
    const key = req.params.key;
    const oldfileName = req.params.imagename;
    const newfilename = req.body.filename;
    const value = req.body.value;
    if (key && oldfileName) {
        const contents = JSON.parse(fs.readFileSync(`./public/license/license.json`));
        readLicenseFile(contents, key).then(response => {
            if (response.present) {
                var fileIndex = contents.licensekey[response.index][key].key.indexOf(oldfileName);
                if (fileIndex !== -1) {
                    try {
                        mysql.query(`Select * from mindmaps where mindmap_name='${oldfileName}' and licensekey_name='${key}'`, (err, results, fields) => {
                            if (err) res.status(400).json({ message: err.message })
                            else {
                                let fileSqlId = results[0].mindmap_id;
                                mysql.query(`UPDATE mindmaps SET mindmap_name='${newfilename}', mindmap_json='${value}', date_updated='${new Date().toISOString().slice(0, 19).replace('T', ' ')}' WHERE mindmap_id=${fileSqlId} and licensekey_name='${key}'`, (err, results) => {
                                    if (err) res.status(400).json({ message: err.message })
                                    else {
                                        contents.licensekey[response.index][key].key[fileIndex] = newfilename;
                                        writeToLicenseKey(contents)
                                            .then(() => res.status(200).json({ message: 'Image Updated' }))
                                            .catch(() => res.status(200).json({ message: 'Cannot write to file!' }))
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
                mindmap_name: filename,
                date_created: new Date(),
                mindmap_json: JSON.stringify(file)
            };
            mysql.query('Insert into mindmaps SET ?', details, (err, results, fields) => {
                if (err) res.status(400).json({ message: err.message })
            })
        });
    });
}

router.use('/mindmap', require('./notification.route'));
// router.get('/read', (req, res, next) => {
//   readFiles('./public/afimm_2017/');
//   res.status(200).json({message : 'sucess'});
// })


module.exports = router;