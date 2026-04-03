const twilio = require('twilio');

export default async function handler(req, res) {
  // Only allow POST requests (Twilio sends POST by default)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { Body, From } = req.body; // Body is the text message, From is the user's number

  console.log(`Received message from ${From}: ${Body}`);

  // TODO: Step 1 - Send 'Body' to Gemini/OpenAI to extract product intent
  // TODO: Step 2 - Search web/Amazon for the product
  // TODO: Step 3 - Generate affiliate link

  // Mock response for testing the MVP connection
  const mockDeal = `Shopr found a match! 🎉\n\nYou asked for: "${Body}"\n\nBest deal we found: $0.00\nCheckout here: https://shopr.com/mock-checkout`;

  // Generate Twilio XML (TwiML) response
  const twiml = new twilio.twiml.MessagingResponse();
  twiml.message(mockDeal);

  // Send the response back to Twilio
  res.setHeader('Content-Type', 'text/xml');
  res.status(200).send(twiml.toString());
}
