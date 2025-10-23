const express = require('express');
const fetch = require('node-fetch'); // or use global fetch in Node 18+
const { URLSearchParams } = require('url');
const router = express.Router();

router.post('/click2call', async (req, res) => {
  console.log("API trigger...ssss");
  
  try {
    console.log("ApI calling....... Vishal");
    
    const { caller, receiver, custom, retry = '0' } = req.body;
    // Basic input validation
    if (!caller || !receiver || !custom) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const body = new URLSearchParams();
    body.append('method', 'dial.click2call');
    body.append('format', 'json');
    body.append('caller', caller);
    body.append('receiver', receiver);
    body.append('custom', custom); // visit id
    body.append('retry', retry);
    const r = await fetch('https://api-voice.kaleyra.com/v1/', {
      method: 'POST',
      headers: { 'x-api-key': process.env.KALEYRA_API_KEY },
      body
    });
    const text = await r.text(); // pass through raw response
    res.status(r.status).type(r.headers.get('content-type') || 'application/json').send(text);
  } catch (e) {
    console.error('Kaleyra call failed', e);
    res.status(500).json({ error: 'Kaleyra call failed' });
  }
});

module.exports = router;
