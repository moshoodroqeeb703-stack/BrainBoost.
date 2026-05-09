export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ error: "No question provided" });

    const apiKey = process.env.GEMINI_API_KEY;

    // Check if API key exists in Vercel
    if (!apiKey) {
      return res.status(500).json({ 
        error: "API key missing! Go to Vercel → Settings → Environment Variables → Add GEMINI_API_KEY" 
      });
    }

    const prompt = `You are BrainBoost AI, a helpful tutor for Nigerian students (WAEC, NECO, JAMB, university level).

Give REAL, ACCURATE, DETAILED answers. Never be vague.

Rules:
- Maths: Show full step-by-step working
- Sciences: Accurate facts with clear explanations
- Coding: Complete working code with explanations  
- Essays: Proper structured content
- History: Accurate dates and facts
- Use simple English students understand
- Use emojis (📝💡✅🔢⚗️💻)
- End with: "✅ This answer is accurate and unique for you!"

Student question: ${question}`;

    // Try different model + version combinations
    const attempts = [
      { version: "v1beta", model: "gemini-2.0-flash" },
      { version: "v1beta", model: "gemini-1.5-flash" },
      { version: "v1beta", model: "gemini-1.5-flash-latest" },
      { version: "v1beta", model: "gemini-1.5-flash-8b" },
      { version: "v1beta", model: "gemini-pro" },
      { version: "v1", model: "gemini-pro" },
      { version: "v1", model: "gemini-1.5-flash" },
    ];

    for (const attempt of attempts) {
      try {
        const url = `https://generativelanguage.googleapis.com/${attempt.version}/models/${attempt.model}:generateContent?key=${apiKey}`;
        
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 2048,
            }
          })
        });

        const data = await response.json();

        // Check for invalid API key specifically
        if (data.error?.status === "UNAUTHENTICATED" || data.error?.status === "PERMISSION_DENIED") {
          return res.status(401).json({ 
            error: "Invalid API key! Check your key in Vercel Environment Variables!" 
          });
        }

        // If this model works, return the answer
        if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
          return res.status(200).json({ 
            answer: data.candidates[0].content.parts[0].text 
          });
        }

      } catch (e) {
        continue; // Try next model
      }
    }

    // All models failed
    return res.status(500).json({ 
      error: "All AI models failed. Please check your API key in Vercel settings is correct!" 
    });

  } catch (error) {
    return res.status(500).json({ error: "Server error: " + error.message });
  }
}
