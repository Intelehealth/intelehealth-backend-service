var express = require('express');
var router = express.Router();

/* GET home page. */
router.post('/webhook', function(req, res, next) {
  console.log(JSON.stringify(req.body, null, 4));
  return res.status(200).json(req.body);
});

router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

module.exports = router;

//ejN0ElTrk5GGH7aIDQyzl7ehFiTAb/JlFMxyEHqB+PdA9754prPXmlzZimejZaym