const twilio = require('twilio');

module.exports = async function(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { Body, From } = req.body;
  console.log(`Received message from ${From}: ${Body}`);

  const twiml = new twilio.twiml.MessagingResponse();

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const prompt = `
      You are Shopr, an AI shopping assistant that works over SMS.
      A user just texted you this request: "${Body}"
      
      Step 1: Identify exactly what product they want.
      Step 2: Write a friendly, concise SMS response (under 200 characters). 
      Step 3: Since we are building the real web search next, just invent a realistic "best deal" price and provide a mock link like https://shopr.com/checkout/123.
      
      Make it sound like you actually scoured the web and found them a great deal.
    `;

    // Instead of dealing with Google's buggy SDK package, we just hit their API directly!
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
       console.error("Gemini API Error:", data);
       throw new Error("Gemini API returned an error");
    }

    const aiResponse = data.candidates[0].content.parts[0].text;
    console.log(`AI Response generated: ${aiResponse}`);

    twiml.message(aiResponse);

  } catch (error) {
    console.error('Error with AI processing:', error);
    twiml.message("Oops, our AI shopping brain is taking a quick nap. Try again in a minute!");
  }

  res.setHeader('Content-Type', 'text/xml');
  res.status(200).send(twiml.toString());
}
