export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
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

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "API key not configured in Vercel" });
    }

    // Try models in order until one works
    const models = [
      "gemini-2.0-flash",
      "gemini-pro",
      "gemini-1.0-pro",
      "gemini-1.5-pro"
    ];

    let answer = null;
    let lastError = null;

    for (const model of models) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: `You are BrainBoost AI, a helpful tutor for Nigerian secondary school and university students preparing for WAEC, NECO, JAMB and other exams.

You MUST give REAL, ACCURATE, DETAILED answers to every question. Never give vague or generic responses.

Rules:
- Mathematics: Show full step-by-step working
- Sciences: Give accurate facts with clear explanations  
- Coding: Provide complete working code with comments
- Essays: Give proper structured content
- History/Social Sciences: Give accurate dates, facts, events
- Always use simple English that students understand
- Use emojis to make responses friendly (📝, 💡, ✅, 🔢 etc.)
- End EVERY response with: "✅ This answer is accurate and unique for you!"

Student question: ${question}

Give a complete, helpful answer now:`
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

        if (response.ok && data.candidates && data.candidates[0]) {
          answer = data.candidates[0].content.parts[0].text;
          break; // Found working model, stop trying
        } else {
          lastError = data.error?.message || "Unknown error";
        }
      } catch (modelError) {
        lastError = modelError.message;
        continue; // Try next model
      }
    }

    if (answer) {
      return res.status(200).json({ answer });
    } else {
      return res.status(500).json({ 
        error: `AI error: ${lastError}. Please try again!` 
      });
    }

  } catch (error) {
    return res.status(500).json({ error: "Server error: " + error.message });
  }
}
