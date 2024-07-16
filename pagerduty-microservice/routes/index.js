var express = require('express');
var router = express.Router();
const { createTicket, getPriorities, getEscalationPolicies, getTicket, getUserTickets } = require('../controllers/pagerduty.controller');
const { validate } = require("../middlewares/validation.middleware");
const { authMiddleware } = require("../middlewares/auth.middleware");
const { createTicketSchema, getTicketSchema, getTicketsSchema } = require('../validators/schemas');
const { updateTicketStatusDatabase } = require('../services/pagerduty.service');

/* GET home page. */
router.post('/webhook', function(req, res, next) {
 if(process.env.PAGERDUTY_API_TOKEN !== req.headers['x-pagerduty-api-token']) {
    return res.status(200).send('OK');
 }
  updateTicketStatusDatabase(req?.body?.event);
  return res.status(200).send('OK');
});

// router.get('/', function(req, res, next) {
//   res.render('index', { title: 'Express' });
// });
router.get('/getPriorities', [authMiddleware, getPriorities]);
router.get('/getEscalationPolicies', [authMiddleware, getEscalationPolicies]);
router.post('/createTicket', [authMiddleware, validate(createTicketSchema, 'body'), createTicket]);
router.get('/getTicket/:id', [authMiddleware, validate(getTicketSchema, 'params'), getTicket]);
router.get('/getUserTickets', [authMiddleware, validate(getTicketsSchema, 'query'), getUserTickets]);

module.exports = router;