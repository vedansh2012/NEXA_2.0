const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const MODE_INSTRUCTIONS = {
  normal: "Be helpful, accurate, friendly and concise.",
  study: "Teach step by step. Explain concepts clearly, use examples, and help the student understand rather than only giving an answer.",
  coding: "Act as a careful programming assistant. Give working code, explain important changes, and debug errors precisely.",
  research: "Give structured, evidence-aware answers. Distinguish known facts from uncertainty and avoid inventing sources or facts.",
  creative: "Help creatively while following the user's requested format, tone and constraints.",
  job: "Help with careers, skills and job descriptions. Be realistic and do not invent qualifications or experience.",
  quick: "Answer directly and briefly. Include only the useful information needed to answer the question.",
  deep: "Analyze the problem carefully and give a thorough, structured answer with reasoning and practical conclusions."
};

function cleanHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter(item => item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string")
    .slice(-12)
    .map(item => ({ role: item.role, content: item.content.slice(0, 12000) }));
}

// Health check
app.get("/api/status", (req, res) => {
  res.json({
    online: true,
    name: "NEXA",
    version: "2.0",
    provider: "OpenRouter"
  });
});

// NEXA AI Chat — OpenRouter
app.post("/api/chat", async (req, res) => {
  const message = req.body?.message;
  const mode = MODE_INSTRUCTIONS[req.body?.mode] ? req.body.mode : "normal";

  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Please enter a message." });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || apiKey === "your_api_key_here") {
    return res.status(503).json({
      error: "OpenRouter API key is not configured. Add it to your local .env file."
    });
  }

  const model = process.env.OPENROUTER_MODEL || "openrouter/free";
  const history = cleanHistory(req.body?.history);

  const messages = [
    {
      role: "system",
      content: `You are NEXA 2.0, a helpful AI assistant created by MESSIAH_V. ${MODE_INSTRUCTIONS[mode]} Never claim to have performed an action you did not perform. If information is uncertain, say so.`
    },
    ...history,
    { role: "user", content: message.trim() }
  ];

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-OpenRouter-Title": "NEXA 2.0"
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 1500
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("OpenRouter API HTTP status:", response.status);
      console.error("OpenRouter API error:", data?.error?.message || "Unknown provider error");

      const providerMessage = data?.error?.message;
      return res.status(502).json({
        error: providerMessage
          ? `NEXA AI provider error: ${providerMessage}`
          : "NEXA AI could not respond. Check the server terminal for details."
      });
    }

    const reply = data?.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) {
      return res.status(502).json({ error: "The AI provider returned an empty response." });
    }

    return res.json({ reply: reply.trim(), model });
  } catch (error) {
    console.error("NEXA chat error:", error.message);
    return res.status(502).json({ error: "Could not connect to OpenRouter. Check your internet connection and try again." });
  }
});

// Job Skills Analyzer
app.post("/api/job-analyzer", (req, res) => {
  const { skills, jobDescription } = req.body || {};

  if (typeof skills !== "string" || typeof jobDescription !== "string" || !skills.trim() || !jobDescription.trim()) {
    return res.status(400).json({ error: "Please provide both your skills and the job description." });
  }

  const normalize = text => text.toLowerCase().match(/[a-z0-9+#.]+/g) || [];
  const stopWords = new Set([
    "the", "and", "for", "with", "you", "your", "are", "our", "this", "that", "from",
    "have", "has", "will", "can", "who", "all", "any", "job", "work", "role", "team",
    "ability", "experience", "skills", "skill", "knowledge", "good", "strong", "years",
    "using", "use", "looking", "seeking", "candidate", "responsibilities", "requirements"
  ]);

  const skillWords = [...new Set(normalize(skills).filter(word => word.length > 1 && !stopWords.has(word)))];
  const jobWords = [...new Set(normalize(jobDescription).filter(word => word.length > 1 && !stopWords.has(word)))];
  const matched = skillWords.filter(word => jobWords.includes(word));
  const missing = jobWords.filter(word => !skillWords.includes(word));
  const matchPercentage = jobWords.length ? Math.round((matched.length / jobWords.length) * 100) : 0;

  return res.json({
    success: true,
    matchPercentage,
    matchedKeywords: matched.slice(0, 30),
    suggestedKeywordsToDevelop: missing.slice(0, 20),
    summary: `Found ${matched.length} overlapping keywords out of ${jobWords.length} job-description keywords.`,
    note: "This is a basic keyword comparison, not a hiring decision or assessment of your actual qualifications. Only claim skills you genuinely have."
  });
});

// Food Assistant
app.post("/api/food-assistant", (req, res) => {
  const { ingredients, preferences } = req.body || {};

  if (typeof ingredients !== "string" || !ingredients.trim()) {
    return res.status(400).json({ error: "Please enter the ingredients you have." });
  }

  const available = ingredients.toLowerCase();
  const preference = typeof preferences === "string" ? preferences.toLowerCase() : "";

  const recipes = [
    { name: "Vegetable Pulao", ingredients: ["rice", "vegetable", "peas", "carrot"], description: "Rice cooked with vegetables and mild spices." },
    { name: "Aloo Paratha", ingredients: ["potato", "atta", "flour"], description: "Stuffed flatbread with a spiced potato filling." },
    { name: "Besan Chilla", ingredients: ["besan", "gram flour"], description: "A savoury gram-flour pancake with spices and optional vegetables." },
    { name: "Dal Chawal", ingredients: ["dal", "lentil", "rice"], description: "Comforting lentils served with rice." },
    { name: "Vegetable Sandwich", ingredients: ["bread", "tomato", "cucumber"], description: "A quick vegetable sandwich with your preferred seasoning." },
    { name: "Paneer Bhurji", ingredients: ["paneer", "tomato", "onion"], description: "Crumbled paneer cooked with onion, tomato and spices." },
    { name: "Masala Omelette", ingredients: ["egg", "eggs"], description: "Eggs cooked with vegetables and seasoning; cook thoroughly." }
  ];

  let suggestions = recipes
    .map(recipe => ({
      ...recipe,
      matchedIngredients: recipe.ingredients.filter(item => available.includes(item))
    }))
    .filter(recipe => recipe.matchedIngredients.length > 0)
    .sort((a, b) => b.matchedIngredients.length - a.matchedIngredients.length);

  if (preference.includes("vegan")) {
    suggestions = suggestions.filter(recipe => !["Masala Omelette", "Paneer Bhurji"].includes(recipe.name));
  } else if (preference.includes("vegetarian")) {
    suggestions = suggestions.filter(recipe => recipe.name !== "Masala Omelette");
  }

  suggestions = suggestions.slice(0, 4);

  return res.json({
    success: true,
    suggestions,
    note: "Suggestions use basic ingredient matching. Check ingredients and cook food safely."
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`NEXA 2.0 running at http://localhost:${PORT}`);
});
