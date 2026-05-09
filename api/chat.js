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

    // Updated 2025/2026 models - newest first
    const models = [
      "gemini-2.5-flash",
      "gemini-3-flash-preview",
      "gemini-2.0-flash",
      "gemini-2.5-pro",
      "gemini-2.0-flash-lite",
    ];

    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
        
        const response = await fetch(url, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            // KEY IS NOW SENT IN HEADER (new Google requirement!)
            "x-goog-api-key": apiKey
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 2048,
            }
          })
        });

        const data = await response.json();

        // Invalid API key
        if (data.error?.status === "UNAUTHENTICATED" || 
            data.error?.status === "PERMISSION_DENIED") {
          return res.status(401).json({ 
            error: "Invalid API key! Please check your key in Vercel Environment Variables is correct and not expired!" 
          });
        }

        // Model not found - try next one
        if (data.error?.status === "NOT_FOUND") {
          continue;
        }

        // Success!
        if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
          return res.status(200).json({ 
            answer: data.candidates[0].content.parts[0].text 
          });
        }

      } catch (e) {
        continue;
      }
    }

    return res.status(500).json({ 
      error: "Could not connect to AI. Please check your API key is valid!" 
    });

  } catch (error) {
    return res.status(500).json({ error: "Server error: " + error.message });
  }
}
