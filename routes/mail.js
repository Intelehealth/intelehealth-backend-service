const express = require('express');
const router = express.Router();
const sgMail = require('@sendgrid/mail');
const fs = require("fs")


sgMail.setApiKey('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');


// router.post('/upload', (req, res) => {
//     let prescription = req.body.prescription;
//         const msg = {
//             to: 'neha@intelehealth.io',
//             from: 'vibha@intelehealth.io',
//             dynamic_template_data: {
//                 subject: 'Teleconsultation Report',
//                 body: 'Here is your report'
//             },
//             templateId: 'd-3f661d429041400ba70f9a472efc7e46',
//             attachments: [{
//                 content: prescription,
//                 filename: 'Report.pdf',
//                 type: 'application/pdf' ,
//                 disposition: 'attachment',
//                 contentId: 'mytext'
//                 },
//             ],
//         };  
//         sgMail
//         .send(msg)
//         .then((response) => {
//             console.log(response)
//             res.status(200).json({message: 'Send Successfully'})
//         }, error => {
//           console.error(error);
//           if (error.response) {
//             console.error(error.response.body)
//             res.status(400).json({message: 'Not Send'})

//           }
//         });
// });

module.exports = router;