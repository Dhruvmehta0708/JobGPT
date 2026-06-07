import axios from "axios";

function buildPrompt(profile, job) {
  return `
Evaluate job relevance for this candidate and return strict JSON only.

Candidate:
- Target role: ${profile.role}
- Skills: ${(profile.skills || []).join(", ")}
- Experience years: ${profile.experienceYears ?? "unknown"}
- Preferred location: ${profile.location || "India"}
- Remote allowed: ${Boolean(profile.remoteOk)}

Job:
- Title: ${job.title}
- Company: ${job.company}
- Location: ${job.location}
- Description: ${job.description}
- Extracted skills: ${(job.skillsExtracted || []).join(", ")}
- Posted date: ${job.postedAt}

Scoring weights:
- Role alignment (35%)
- Skill overlap and depth (35%)
- Experience fit (15%)
- Location fit for India preference (10%)
- Recency and quality (5%)

Hard penalties:
- Wrong domain/role: -30 to -60
- Skill overlap below 40%: final score max 39
- Non-India irrelevant location when India requested: -20
- Vague low-quality posting: -10

Return JSON with keys:
score (0-100 integer), verdict ("high"|"moderate"|"low"), reasons (string[] max 3), missingSkills (string[]), confidence (0-1 number)
`;
}

function estimateExperienceYears(experience = "") {
  const match = String(experience).match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function heuristicScore(profile, job, hardScores) {
  const weighted = hardScores.roleScore * 40 + hardScores.skillScore * 40 + hardScores.locationScore * 20;
  const base = Math.round(Math.max(0, Math.min(100, weighted)));
  const recencyDays = Math.max(0, (Date.now() - new Date(job.postedAt).getTime()) / (24 * 60 * 60 * 1000));
  const recencyBoost = Math.max(0, 4 - recencyDays * 0.1);
  const expYears = estimateExperienceYears(profile.experience || profile.experienceYears);
  const expBoost = expYears >= 1 ? 2 : 0;
  return Math.round(Math.min(100, base + recencyBoost + expBoost));
}

export async function scoreJobWithAI(profile, job, hardScores) {
  const apiKey = process.env.OPENAI_API_KEY;
  const fallbackScore = heuristicScore(profile, job, hardScores);

  if (!apiKey) {
    return {
      score: fallbackScore,
      verdict: fallbackScore > 70 ? "high" : fallbackScore >= 40 ? "moderate" : "low",
      reasons: ["Heuristic fallback used because OPENAI_API_KEY is not configured."],
      missingSkills: [],
      confidence: 0.45
    };
  }

  let response;
  try {
    response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You are a strict job relevance evaluator for Indian tech hiring. Return valid JSON only."
          },
          { role: "user", content: buildPrompt(profile, job) }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        timeout: 25000
      }
    );
  } catch {
    return {
      score: fallbackScore,
      verdict: fallbackScore > 70 ? "high" : fallbackScore >= 40 ? "moderate" : "low",
      reasons: ["OpenAI request failed. Fallback score used."],
      missingSkills: [],
      confidence: 0.5
    };
  }

  const raw = response?.data?.choices?.[0]?.message?.content || "{}";
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }

  const score = Number.isFinite(parsed.score) ? Math.round(parsed.score) : fallbackScore;
  return {
    score,
    verdict: parsed.verdict || (score > 70 ? "high" : score >= 40 ? "moderate" : "low"),
    reasons: Array.isArray(parsed.reasons) ? parsed.reasons.slice(0, 3) : [],
    missingSkills: Array.isArray(parsed.missingSkills) ? parsed.missingSkills.slice(0, 8) : [],
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.6
  };
}
