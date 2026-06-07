import pLimit from "p-limit";
import Job from "../models/Job.js";
import { fetchAllJobs } from "./fetchService.js";
import { ruleBasedScore, aiScore, classifySPT } from "./scoringService.js";

// 🔒 Sirf 2 concurrent AI calls (rate limit avoid karne ke liye)
const limit = pLimit(2);

// ⏳ Sleep helper
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// 🔁 Retry wrapper — 429 aane pe wait karke dobara try karta hai
async function aiScoreWithRetry(job, user, retries = 3, delayMs = 3000) {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await aiScore(job, user);
      return result;
    } catch (err) {
      const is429 =
        err?.status === 429 ||
        err?.message?.includes("429") ||
        err?.message?.includes("rate_limit");

      if (is429 && i < retries - 1) {
        console.warn(`⚠️ Rate limit hit, waiting ${delayMs / 1000}s... (attempt ${i + 1}/${retries})`);
        await sleep(delayMs);
        delayMs *= 1.5; // har retry pe thoda zyada wait
      } else {
        console.error(`❌ AI scoring failed for "${job.title}":`, err.message);
        return { score: 0, summary: "", whyFit: "", missingSkills: [], suggestion: "" };
      }
    }
  }
}

export async function runAgentForUser(user) {
  console.log(`\n🤖 Agent running for ${user.email} (${user.role})`);
  const start = Date.now();

  // ── 1. Fetch jobs ─────────────────────────────────────
  const uniqueJobs = await fetchAllJobs(user);

  // ── 2. Remove duplicates (DB level) ───────────────────
  const incomingUrls = uniqueJobs.map((j) => j.url);

  const existingDocs = await Job.find(
    { userId: user._id, url: { $in: incomingUrls } },
    { url: 1 }
  ).lean();

  const existingUrls = new Set(existingDocs.map((d) => d.url));
  const newJobs = uniqueJobs.filter((j) => !existingUrls.has(j.url));

  console.log(`🆕 New jobs: ${newJobs.length}`);

  if (newJobs.length === 0) {
    return { targets: [], prospects: [], suspects: [] };
  }

  // ── 3. Score jobs ─────────────────────────────────────
  const scoredJobs = await Promise.all(
    newJobs.map((job) =>
      limit(async () => {
        await sleep(1000); // ✅ har call se pehle 1s wait

        const rule = ruleBasedScore(job, user);
        const result = await aiScoreWithRetry(job, user);

        const groqScore = result.score;
        const totalScore = rule + groqScore;
        const sptClass = classifySPT(totalScore);

        const icon =
          sptClass === "Target" ? "🎯" :
          sptClass === "Prospect" ? "👀" : "🔍";

        console.log(`  ${icon} ${job.title} @ ${job.company} → ${totalScore}/100`);

        return {
          userId: user._id,
          source: job.source,
          title: job.title,
          company: job.company,
          url: job.url,
          location: job.location,
          salary: job.salary,
          tags: job.tags,
          description: job.description,

          sptClass,
          ruleScore: rule,
          aiScore: groqScore,
          totalScore,

          aiSummary: result.summary,
          whyFit: result.whyFit,
          missingSkills: result.missingSkills,
          suggestion: result.suggestion,
        };
      })
    )
  );

  // ── 4. Bulk insert ────────────────────────────────────
  const inserted = await Job.insertMany(scoredJobs, { ordered: false });

  // ── 5. Group into SPT ─────────────────────────────────
  const saved = { targets: [], prospects: [], suspects: [] };

  for (const job of inserted) {
    saved[job.sptClass.toLowerCase() + "s"].push(job);
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`✅ Done in ${elapsed}s — 🎯${saved.targets.length} 👀${saved.prospects.length} 🔍${saved.suspects.length}`);

  return saved;
}