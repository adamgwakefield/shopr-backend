const twilio = require('twilio');
const { createClient } = require('@supabase/supabase-js');

module.exports = async function(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { Body, From } = req.body;
  console.log(`Received message from ${From}: ${Body}`);

  const twiml = new twilio.twiml.MessagingResponse();

  try {
    const geminiKey = process.env.GEMINI_API_KEY;
    const serperKey = process.env.SERPER_API_KEY;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    // STEP 0: Save the user and search query to our Database silently in the background
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      supabase.from('searches').insert([{ phone: From, query: Body }])
        .then(({error}) => { if(error) console.error("Supabase Error:", error) });
    }

    // STEP 1: Search the real web (Google Shopping)
    console.log(`Searching Serper for: ${Body}`);
    const searchRes = await fetch("https://google.serper.dev/shopping", {
      method: "POST",
      headers: {
        "X-API-KEY": serperKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ q: Body, gl: "us" }) // gl: 'us' ensures we get US pricing/stores
    });
    
    const searchData = await searchRes.json();
    
    // Extract the top result
    let dealContext = "We couldn't find any current listings for that exact item.";
    if (searchData.shopping && searchData.shopping.length > 0) {
      const bestItem = searchData.shopping[0]; // Grab the #1 Google Shopping result
      dealContext = `Top match: "${bestItem.title}" from ${bestItem.source}. Price: ${bestItem.price}. Checkout Link: ${bestItem.link}`;
      console.log("Real Deal Found:", dealContext);
    }

    // STEP 2: Give the real data to Gemini to write the SMS
    const prompt = `
      You are Shopr, an AI shopping assistant over SMS.
      User request: "${Body}"
      
      Real-time search results:
      ${dealContext}
      
      Write a friendly, concise SMS response (under 200 characters). 
      Tell them the price, where it's from, and include the exact link so they can buy it immediately. 
      Keep it conversational. DO NOT use asterisks for bolding (like **this**), just plain text.
    `;

    const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const aiData = await aiRes.json();
    
    if (!aiRes.ok) {
       throw new Error(JSON.stringify(aiData.error) || "Unknown Gemini Error");
    }

    const aiResponse = aiData.candidates[0].content.parts[0].text;
    console.log(`AI Response generated: ${aiResponse}`);

    twiml.message(aiResponse);

  } catch (error) {
    const keyHint = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0,4) : "UNDEFINED";
    twiml.message("DEBUG_ERROR: " + error.message + " | KEY: " + keyHint);
  }

  res.setHeader('Content-Type', 'text/xml');
  res.status(200).send(twiml.toString());
}
