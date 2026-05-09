export default async function handler(req, res) {
  // Allow requests from your website only
  res.setHeader("Access-Control-Allow-Origin", "https://brain-boost-sfib.vercel.app");
  res.setHeader("Access-Control-Allow-Methods", "POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({ error: "No question provided" });
    }

    // API key is hidden here - stored in Vercel environment variables
    // Nobody can see this key! Not even in GitHub!
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "API key not configured" });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are BrainBoost AI, a helpful tutor for Nigerian students studying for WAEC, NECO, and university exams.

Give REAL, ACCURATE, DETAILED answers. For math show step-by-step working. For science explain clearly with examples. For code give working examples. Use emojis to be friendly. End with "✅ This answer is accurate and unique for you!"

Student question: ${question}`
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: data.error?.message || "AI error" });
    }

    const answer = data.candidates[0]?.content?.parts[0]?.text || "Sorry, please try again!";
    return res.status(200).json({ answer });

  } catch (error) {
    return res.status(500).json({ error: "Server error: " + error.message });
  }
}
