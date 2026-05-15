export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { question, prompt } = req.body;
    if (!question) return res.status(400).json({ error: "No question provided" });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ 
        error: "API key missing! Add GEMINI_API_KEY in Vercel settings" 
      });
    }

    const finalPrompt = prompt || 
      `You are BrainBoost AI for Nigerian students. Answer: ${question}`;

    // ✅ FIXED: Removed gemini-2.5-flash (not released)
    const models = [
      "gemini-2.0-flash",
      "gemini-1.5-flash-latest",
      "gemini-2.0-flash-lite",
      "gemini-1.5-flash",
    ];

    const errors = []; // collect errors for debugging

    for (const model of models) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: finalPrompt }] }],
              generationConfig: { 
                temperature: 0.7, 
                maxOutputTokens: 4096 // ✅ INCREASED for coding
              },
              // ✅ NEW: Relax safety for coding/educational content
              safetySettings: [
                {
                  category: "HARM_CATEGORY_HARASSMENT",
                  threshold: "BLOCK_ONLY_HIGH"
                },
                {
                  category: "HARM_CATEGORY_HATE_SPEECH", 
                  threshold: "BLOCK_ONLY_HIGH"
                },
                {
                  category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                  threshold: "BLOCK_ONLY_HIGH"
                }
              ]
            })
          }
        );

        const data = await response.json();

        // Auth errors - stop immediately
        if (
          data.error?.status === "UNAUTHENTICATED" || 
          data.error?.status === "PERMISSION_DENIED"
        ) {
          return res.status(401).json({ 
            error: "Invalid API key! Check Vercel Environment Variables!" 
          });
        }

        // Model not found - try next
        if (data.error?.status === "NOT_FOUND") {
          errors.push(`${model}: NOT_FOUND`);
          continue;
        }

        // Rate limit - try next
        if (data.error?.status === "RESOURCE_EXHAUSTED") {
          errors.push(`${model}: RATE_LIMITED`);
          continue;
        }

        // ✅ NEW: Handle safety block
        const finishReason = data.candidates?.[0]?.finishReason;
        if (finishReason === "SAFETY") {
          errors.push(`${model}: SAFETY_BLOCKED`);
          // Try simpler prompt on next model
          continue;
        }

        // ✅ Success - return answer
        const answer = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (response.ok && answer) {
          return res.status(200).json({ answer: answer });
        }

        errors.push(`${model}: ${data.error?.message || "Empty response"}`);

      } catch (e) { 
        errors.push(`${model}: ${e.message}`);
        continue; 
      }
    }

    // ✅ Now shows WHY each model failed
    return res.status(500).json({ 
      error: "All AI models failed. Check your API key!",
      debug: errors // remove this line after fixing
    });

  } catch (error) {
    return res.status(500).json({ error: "Server error: " + error.message });
  }
      }
