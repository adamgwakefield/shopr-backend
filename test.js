const fetch = require('node-fetch'); // You might need to run: npm install node-fetch

async function testTwilioWebhook() {
  const webhookUrl = 'https://shopr-backend.vercel.app/api/webhook'; // Or http://localhost:3000/api/webhook for local testing
  
  const payload = new URLSearchParams({
    From: '+1234567890',
    Body: 'I am looking for a pair of black Nike Air Max size 10 under $100'
  });

  console.log(`Sending fake text to ${webhookUrl}...`);
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: payload
    });

    const text = await response.text();
    console.log('\n--- TWILIO RESPONSE ---');
    console.log(text);
    console.log('-----------------------\n');
  } catch (err) {
    console.error('Error:', err);
  }
}

testTwilioWebhook();