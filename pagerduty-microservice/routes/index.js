var express = require('express');
var router = express.Router();
const { createTicket, getPriorities, getEscalationPolicies, getTicket, getUserTickets } = require('../controllers/pagerduty.controller');
const { validate } = require("../middlewares/validation.middleware");
const { authMiddleware } = require("../middlewares/auth.middleware");
const { createTicketSchema, getTicketSchema } = require('../validators/schemas');

/* GET home page. */
// router.get('/', function(req, res, next) {
//   res.render('index', { title: 'Express' });
// });
router.get('/getPriorities', [authMiddleware, getPriorities]);
router.get('/getEscalationPolicies', [authMiddleware, getEscalationPolicies]);
router.post('/createTicket', [authMiddleware, validate(createTicketSchema, 'body'), createTicket]);
router.get('/getTicket/:id', [authMiddleware, validate(getTicketSchema, 'params'), getTicket]);
router.get('/getUserTickets', [authMiddleware, getUserTickets]);

module.exports = router;
