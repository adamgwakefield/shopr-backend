const twilio = require('twilio');
const { createClient } = require('@supabase/supabase-js');

const AMAZON_TAG = 'shoprsms-20';

function injectAffiliateTag(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('amazon.com')) {
      parsed.searchParams.set('tag', AMAZON_TAG);
      return parsed.toString();
    }
  } catch (e) {
    // invalid URL, return as-is
  }
  return url;
}

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

    // STEP 0: Save the user and search query to Supabase silently in the background
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      supabase.from('searches').insert([{ phone: From, query: Body }])
        .then(({ error }) => { if (error) console.error("Supabase Error:", error); });
    }

    // STEP 1: Use Gemini to extract a clean, optimized search query from the user's message
    console.log(`Extracting search intent from: ${Body}`);
    const intentRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Extract a clean, concise Google Shopping search query from this user message. Return ONLY the search query, nothing else. No explanation, no punctuation around it.\n\nUser message: "${Body}"`
          }]
        }]
      })
    });

    const intentData = await intentRes.json();
    const cleanQuery = intentData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || Body;
    console.log(`Clean search query: ${cleanQuery}`);

    // STEP 2: Search Google Shopping with the clean query
    console.log(`Searching Serper for: ${cleanQuery}`);
    const searchRes = await fetch("https://google.serper.dev/shopping", {
      method: "POST",
      headers: {
        "X-API-KEY": serperKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ q: cleanQuery, gl: "us" })
    });

    const searchData = await searchRes.json();

    // Extract top 5 results and inject affiliate tags
    let dealContext = "We couldn't find any current listings for that exact item.";
    if (searchData.shopping && searchData.shopping.length > 0) {
      const topDeals = searchData.shopping.slice(0, 5).map((item, i) => {
        const link = injectAffiliateTag(item.link);
        return `${i + 1}. "${item.title}" from ${item.source}. Price: ${item.price}. Link: ${link}`;
      }).join('\n');
      dealContext = topDeals;
      console.log("Top deals found:\n", dealContext);
    }

    // STEP 3: Give Gemini the top results and have it pick the best deal + write the SMS
    const prompt = `You are Shopr, an AI shopping assistant that responds over SMS.

User request: "${Body}"

Real-time search results (top 5):
${dealContext}

Pick the single best deal for the user based on price, relevance, and source reputation.
Write a friendly, concise SMS reply (under 320 characters total, plain text only, no asterisks or markdown).
Include: the product name, price, store, and the full checkout link.
Keep it conversational and helpful.`;

    const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
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

    const aiResponse = aiData.candidates[0].content.parts[0].text.trim();
    console.log(`AI Response: ${aiResponse}`);

    twiml.message(aiResponse);

  } catch (error) {
    console.error("Webhook error:", error);
    twiml.message("Sorry, something went wrong finding that deal. Try again in a moment!");
  }

  res.setHeader('Content-Type', 'text/xml');
  res.status(200).send(twiml.toString());
};
