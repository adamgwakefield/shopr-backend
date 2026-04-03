const twilio = require('twilio');
const { GoogleGenerativeAI } = require('@google/generative-ai');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { Body, From } = req.body;
  console.log(`Received message from ${From}: ${Body}`);

  const twiml = new twilio.twiml.MessagingResponse();

  try {
    // 1. Initialize Gemini using the environment variable we just set
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    // 2. Instruct the AI on how to behave
    const prompt = `
      You are Shopr, an AI shopping assistant that works over SMS.
      A user just texted you this request: "${Body}"
      
      Step 1: Identify exactly what product they want.
      Step 2: Write a friendly, concise SMS response (under 200 characters). 
      Step 3: Since we are building the real web search next, just invent a realistic "best deal" price and provide a mock link like https://shopr.com/checkout/123.
      
      Make it sound like you actually scoured the web and found them a great deal.
    `;

    // 3. Get the AI's response
    const result = await model.generateContent(prompt);
    const aiResponse = result.response.text();

    console.log(`AI Response generated: ${aiResponse}`);

    // 4. Send it back to Twilio
    twiml.message(aiResponse);

  } catch (error) {
    console.error('Error with AI processing:', error);
    twiml.message("Oops, our AI shopping brain is taking a quick nap. Try again in a minute!");
  }

  res.setHeader('Content-Type', 'text/xml');
  res.status(200).send(twiml.toString());
}
