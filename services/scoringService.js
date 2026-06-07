import dotenv from "dotenv";
dotenv.config();

import Groq from "groq-sdk";

function getGroq() {
  if (!process.env.GROQ_API_KEY) {
    console.error("❌ GROQ KEY MISSING");
  }
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}

// ── RULE SCORE ────────────────────────────────────────────────────────────────
export function ruleBasedScore(job, user) {
  let score = 0;
  const text = (job.title + " " + job.description).toLowerCase();

  (user.skills || []).forEach((skill) => {
    if (text.includes(skill.toLowerCase())) score += 5;
  });

  // Bonus: role keyword in title
  if (job.title.toLowerCase().includes((user.role || "").toLowerCase())) {
    score += 10;
  }

  return Math.min(score, 50);
}

// ── SPT CLASSIFICATION ────────────────────────────────────────────────────────
export function classifySPT(total) {
  if (total >= 70) return "Target";
  if (total >= 45) return "Prospect";
  return "Suspect";
}

// ── AI SCORE ──────────────────────────────────────────────────────────────────
export async function aiScore(job, user) {
  const groq = getGroq();

  const prompt = `
You are a professional career coach helping a job seeker evaluate job matches.

Candidate:
- Role: ${user.role}
- Skills: ${JSON.stringify(user.skills || [])}
- Experience: ${user.experience || "Fresher"}

Job:
- Title: ${job.title}
- Company: ${job.company}
- Location: ${job.location}
- Description: ${job.description?.slice(0, 500)}

Analyze this job match and return ONLY valid JSON (no markdown, no explanation):
{
  "score": <number 0-50>,
  "summary": "<1 line insight about this job>",
  "whyFit": "<clear reason why candidate fits this role>",
  "missingSkills": ["<skill1>", "<skill2>"],
  "suggestion": "<1 practical tip to improve chances>"
}
`;

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    });

    const raw = completion.choices[0].message.content
      .replace(/```json|```/g, "")
      .trim();

    const parsed = JSON.parse(raw);

    // ✅ FIXED: Now returns ALL fields
    return {
      score:         typeof parsed.score === "number" ? parsed.score : 0,
      summary:       parsed.summary       || "",
      whyFit:        parsed.whyFit        || "",
      missingSkills: Array.isArray(parsed.missingSkills) ? parsed.missingSkills : [],
      suggestion:    parsed.suggestion    || "",
    };
  } catch (e) {
    console.error("AI scoring error:", e.message);
    return { score: 0, summary: "", whyFit: "", missingSkills: [], suggestion: "" };
  }
}