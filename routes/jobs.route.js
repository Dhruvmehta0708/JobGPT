import express from "express";
import User from "../models/User.js";
import UserJob from "../models/UserJob.js";
import { AppError } from "../middleware/errorHandler.js";
import { catchAsync } from "../middleware/catchAsync.js";
import { fetchFreshJobs } from "../services/jobAggregator.service.js";
import { evaluateHardFilters } from "../services/filterEngine.service.js";
import { scoreJobWithAI } from "../services/aiScoring.service.js";
import { rankJobs } from "../services/ranker.service.js";
import { getJobById, getRecentJobs, upsertJobs } from "../repositories/job.repository.js";
import { logInfo } from "../utils/logger.js";
import { normalizePreferredLocation } from "../utils/indiaLocationMap.js";

const router = express.Router();

const CACHE_TTL_MS = 45 * 60 * 1000;
const refreshCache = new Map();

async function resolveProfile(payload = {}) {
  const user = payload.email ? await User.findOne({ email: payload.email }).lean() : null;
  if (!user && !payload.role) throw new AppError("Provide email or role in request.", 400);

  return {
    email: payload.email || user?.email || "",
    role: payload.role || user?.role || "Software Engineer",
    skills: payload.skills || user?.skills || [],
    experience: payload.experience || user?.experience || "",
    experienceYears: payload.experienceYears ?? undefined,
    location: payload.location || user?.wants?.location || "India",
    preferredLocation: normalizePreferredLocation(payload.preferredLocation || payload.location || user?.wants?.location || "India"),
    remoteOk: payload.remoteOk ?? user?.wants?.remote ?? true
  };
}

async function refreshIfNeeded(profile, forceRefresh = false) {
  const cacheKey = `${profile.role}|${profile.location}|${(profile.skills || []).join(",")}`;
  const lastRefresh = refreshCache.get(cacheKey);
  const stale = !lastRefresh || Date.now() - lastRefresh > CACHE_TTL_MS;

  if (forceRefresh || stale) {
    const fetched = await fetchFreshJobs(profile);
    logInfo("pipeline_count_after_normalization", { jobsAfterNormalization: fetched.length });
    await upsertJobs(fetched);
    refreshCache.set(cacheKey, Date.now());
  }
}

router.post(
  "/search",
  catchAsync(async (req, res) => {
    const debugMode = Boolean(req.body?.debugMode);
    const profile = await resolveProfile(req.body || {});
    await refreshIfNeeded(profile, Boolean(req.body?.freshOnly));

    const jobs = await getRecentJobs({
      location: profile.location,
      preferredLocation: profile.preferredLocation,
      days: 21
    });
    
    // 🔍 STEP 5: AFTER DB LOAD
    console.log(`🔍 AFTER DB: ${jobs.length} jobs loaded for ${profile.preferredLocation}`);
    logInfo("pipeline_count_fetched", { totalFetchedJobs: jobs.length, debugMode });
    const filteredJobs = [];
    const debug = [];
    const roleOnlyRanked = [];
    let hardPassedCount = 0;
    let aiPassedCount = 0;

    for (const job of jobs) {
      // 🔍 STEP 6: VERIFY NORMALIZATION FOR EACH JOB
      console.log(`🔍 NORMALIZATION CHECK for ${job.title}:`, {
        originalLocation: job.location,
        normalizedCountry: job.locationNormalized?.country,
        isRemote: job.locationNormalized?.isRemote,
        preferredLocation: profile.preferredLocation
      });
      
      const hard = evaluateHardFilters(job, profile);
      roleOnlyRanked.push({ job, hard });
      
      // 🚨 TEMP DEBUG BYPASS FOR NON-INDIA LOCATIONS
      const preferredLocation = profile.preferredLocation.toUpperCase();
      const isNonIndiaLocation = preferredLocation !== "IN";
      const shouldBypassLocationFilter = isNonIndiaLocation && hard.rejectReasons.includes("LOCATION_MISMATCH");
      
      if (shouldBypassLocationFilter) {
        console.log(`🔧 DEBUG BYPASS: Skipping location filter for ${preferredLocation} location`);
        // Remove LOCATION_MISMATCH from rejectReasons
        hard.rejectReasons = hard.rejectReasons.filter(reason => reason !== "LOCATION_MISMATCH");
        hard.passed = hard.rejectReasons.length === 0;
      }
      
      // 🔍 STEP 7: FILTER REJECTION LOGGING
      if (!hard.passed) {
        console.log(`🔍 REJECTED: ${job.title}`, {
          preferredLocation: profile.preferredLocation,
          jobCountry: job.locationNormalized?.country || "",
          isRemote: Boolean(job.locationNormalized?.isRemote),
          rejectReasons: hard.rejectReasons,
          bypassed: shouldBypassLocationFilter
        });
      }
      
      logInfo("hard_filter", {
        title: job.title,
        preferredLocation: profile.preferredLocation,
        jobCountry: job.locationNormalized?.country || "",
        isRemote: Boolean(job.locationNormalized?.isRemote),
        roleScore: hard.roleScore,
        skillScore: hard.skillScore,
        locationScore: hard.locationScore,
        rejectReasons: hard.rejectReasons,
        bypassed: shouldBypassLocationFilter
      });

      if (!hard.passed && !debugMode) {
        debug.push({ jobId: job._id, title: job.title, ...hard });
        continue;
      }
      if (hard.rejectReasons.includes("LOCATION_MISMATCH")) {
        debug.push({ jobId: job._id, title: job.title, ...hard });
        continue;
      }
      hardPassedCount += 1;

      const ai = await scoreJobWithAI(profile, job, hard);
      logInfo("ai_score", { title: job.title, aiScore: ai.score, reasons: ai.reasons });
      if (ai.score < 40 && !debugMode) continue;
      aiPassedCount += 1;

      filteredJobs.push({
        ...job,
        isRemote: Boolean(job.locationNormalized?.isRemote),
        aiScore: ai.score,
        totalScore: ai.score,
        aiSummary: ai.reasons?.[0] || "",
        whyFit: ai.reasons?.join(" ") || "",
        missingSkills: ai.missingSkills || [],
        match: {
          roleScore: hard.roleScore,
          skillScore: hard.skillScore,
          locationScore: hard.locationScore,
          aiScore: ai.score,
          aiReason: ai.reasons?.join("; ") || "",
          reasons: ai.reasons || [],
          rejectReasons: []
        }
      });
    }

    // 🔍 STEP 8: AFTER HARD FILTER
    console.log(`🔍 AFTER HARD FILTER: ${hardPassedCount} jobs passed`);
    logInfo("pipeline_count_after_hard_filter", { jobsAfterHardFilter: hardPassedCount });
    // 🔍 STEP 9: AFTER AI SCORING  
    console.log(`🔍 AFTER AI: ${aiPassedCount} jobs passed AI scoring`);
    logInfo("pipeline_count_after_ai_scoring", { jobsAfterAiScoring: aiPassedCount });

    let ranked = rankJobs(filteredJobs, 30);
    
    // 🔍 STEP 10: FINAL RESULT
    console.log(`🔍 FINAL RESULT: ${ranked.length} jobs to return`);
    
    // 🔍 STEP 11: TEMPORARY BYPASS TEST
    if (profile.preferredLocation.toUpperCase() !== "IN" && ranked.length === 0) {
      console.log(`🔧 BYPASS TEST: Forcing return of first 10 jobs for ${profile.preferredLocation}`);
      ranked = jobs.slice(0, 10).map(job => ({
        ...job,
        aiScore: 50,
        totalScore: 50,
        aiSummary: "BYPASS TEST - Forced return",
        whyFit: "This job is returned for debugging purposes"
      }));
      console.log(`🔧 BYPASS TEST: Returning ${ranked.length} forced jobs`);
    }

    if (debugMode && ranked.length < 20) {
      const debugTopups = roleOnlyRanked
        .filter(({ hard }) => !hard.rejectReasons.includes("LOCATION_MISMATCH"))
        .sort((a, b) => b.hard.roleScore - a.hard.roleScore)
        .slice(0, 20)
        .map(({ job, hard }) => ({
          ...job,
          isRemote: Boolean(job.locationNormalized?.isRemote),
          aiScore: Math.round(hard.roleScore * 40 + hard.skillScore * 40 + hard.locationScore * 20),
          totalScore: Math.round(hard.roleScore * 40 + hard.skillScore * 40 + hard.locationScore * 20),
          aiSummary: "Debug mode inclusion based on weighted hard scores.",
          whyFit: "Added in debug mode to ensure visibility of potentially relevant jobs.",
          missingSkills: [],
          match: {
            roleScore: hard.roleScore,
            skillScore: hard.skillScore,
            locationScore: hard.locationScore,
            aiScore: Math.round(hard.roleScore * 40 + hard.skillScore * 40 + hard.locationScore * 20),
            aiReason: "Debug mode",
            reasons: ["Debug mode candidate job"],
            rejectReasons: hard.rejectReasons
          }
        }))
        .filter((candidate) => !ranked.some((existing) => String(existing._id) === String(candidate._id)));
      ranked = rankJobs([...ranked, ...debugTopups], 30);
    }

    // 🚨 ENHANCED FALLBACK FOR NON-INDIA LOCATIONS
    const preferredLocation = profile.preferredLocation.toUpperCase();
    const isNonIndiaLocation = preferredLocation !== "IN";
    
    if (ranked.length < 10 || (isNonIndiaLocation && ranked.length < 20)) {
      console.log(`🔧 ENHANCED FALLBACK: Using relaxed filters for ${preferredLocation} (current: ${ranked.length})`);
      
      const topFallback = roleOnlyRanked
        .filter(({ hard }) => {
          // For non-India locations, be more lenient with location
          if (isNonIndiaLocation) {
            return !hard.rejectReasons.includes("LOW_ROLE_SCORE") && 
                   !hard.rejectReasons.includes("STALE_JOB") && 
                   !hard.rejectReasons.includes("NON_ENGLISH_JOB");
          }
          return !hard.rejectReasons.includes("LOCATION_MISMATCH");
        })
        .sort((a, b) => {
          // Prioritize role score, then skill score
          const scoreA = a.hard.roleScore * 0.6 + a.hard.skillScore * 0.4;
          const scoreB = b.hard.roleScore * 0.6 + b.hard.skillScore * 0.4;
          return scoreB - scoreA;
        })
        .slice(0, isNonIndiaLocation ? 50 : 30)
        .map(({ job, hard }) => ({
          ...job,
          isRemote: Boolean(job.locationNormalized?.isRemote),
          aiScore: Math.round(hard.roleScore * 40 + hard.skillScore * 40 + hard.locationScore * 20),
          totalScore: Math.round(hard.roleScore * 40 + hard.skillScore * 40 + hard.locationScore * 20),
          aiSummary: isNonIndiaLocation 
            ? `Auto-relaxed fallback for ${preferredLocation} to ensure results.`
            : "Auto-relaxed fallback to avoid empty response.",
          whyFit: isNonIndiaLocation
            ? `This job is returned from enhanced fallback for ${preferredLocation} location when strict filtering produces too few results.`
            : "This job is returned from fallback ranking when strict filtering produces too few results.",
          missingSkills: [],
          match: {
            roleScore: hard.roleScore,
            skillScore: hard.skillScore,
            locationScore: hard.locationScore,
            aiScore: Math.round(hard.roleScore * 40 + hard.skillScore * 40 + hard.locationScore * 20),
            aiReason: isNonIndiaLocation ? `Enhanced fallback for ${preferredLocation}` : "Auto-relaxed fallback",
            reasons: isNonIndiaLocation 
              ? [`Returned from enhanced fallback for ${preferredLocation} by role/skill similarity`]
              : ["Returned from fallback ranking by role similarity"],
            rejectReasons: hard.rejectReasons
          }
        }));
      ranked = rankJobs(topFallback, 30);
      logInfo("pipeline_enhanced_fallback", { 
        fallbackReturned: ranked.length, 
        preferredLocation,
        isNonIndiaLocation
      });
    }

    logInfo("pipeline_count_returned", { jobsReturned: ranked.length });
    ranked.forEach((job, index) => {
      logInfo("final_rank", { rank: index + 1, title: job.title, aiScore: job.aiScore });
    });

    res.json({
      success: true,
      total: ranked.length,
      jobsFlat: ranked,
      summary: {
        targets: ranked.filter((j) => j.aiScore > 70).length,
        prospects: ranked.filter((j) => j.aiScore >= 40 && j.aiScore <= 70).length,
        suspects: 0
      },
      debug
    });
  })
);

router.post(
  "/refresh",
  catchAsync(async (req, res) => {
    const profile = await resolveProfile(req.body || {});
    await refreshIfNeeded(profile, true);
    res.json({ success: true, message: "Fresh jobs fetched and cached." });
  })
);

router.get(
  "/:id",
  catchAsync(async (req, res) => {
    const job = await getJobById(req.params.id);
    if (!job) throw new AppError("Job not found.", 404);

    if (!req.query.email) return res.json({ success: true, job });

    const user = await User.findOne({ email: req.query.email }).lean();
    const userJob = user
      ? await UserJob.findOne({ userId: user._id, jobId: job._id }).lean()
      : null;

    res.json({
      success: true,
      job: {
        ...job,
        isSaved: userJob?.isSaved || false,
        status: userJob?.status || "not_applied"
      }
    });
  })
);

router.post(
  "/:id/save",
  catchAsync(async (req, res) => {
    const { email, isSaved = true } = req.body || {};
    const user = await User.findOne({ email });
    if (!user) throw new AppError("User not found.", 404);

    const record = await UserJob.findOneAndUpdate(
      { userId: user._id, jobId: req.params.id },
      { $set: { isSaved } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, record });
  })
);

router.post(
  "/:id/apply-click",
  catchAsync(async (req, res) => {
    const { email } = req.body || {};
    const user = await User.findOne({ email });
    if (!user) throw new AppError("User not found.", 404);

    const record = await UserJob.findOneAndUpdate(
      { userId: user._id, jobId: req.params.id },
      { $set: { status: "applied" } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, record });
  })
);

export default router;
