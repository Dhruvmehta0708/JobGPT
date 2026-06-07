import { normalizeSkills } from "../utils/skillDictionary.js";
import { normalizePreferredLocation } from "../utils/indiaLocationMap.js";

function tokenize(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function jaccardSimilarity(aTokens = [], bTokens = []) {
  const a = new Set(aTokens);
  const b = new Set(bTokens);
  const intersection = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size || 1;
  return intersection / union;
}

export function computeRoleScore(userRole, jobTitle, jobDescription = "") {
  const roleTokens = tokenize(userRole);
  const titleTokens = tokenize(jobTitle);
  const descriptionTokens = tokenize(jobDescription).slice(0, 120);

  const titleSim = jaccardSimilarity(roleTokens, titleTokens);
  const descSim = jaccardSimilarity(roleTokens, descriptionTokens);
  return Number((0.7 * titleSim + 0.3 * descSim).toFixed(3));
}

export function computeSkillScore(userSkills = [], jobSkills = [], jobDescription = "") {
  const user = new Set(normalizeSkills(userSkills));
  const job = new Set(normalizeSkills(jobSkills));

  if (user.size === 0) return 0;

  // ✅ Agar job mein skills/tags nahi hain toh description se match karo
  if (job.size === 0) {
    const descTokens = tokenize(jobDescription);
    const matched = [...user].filter((skill) =>
      descTokens.includes(skill.toLowerCase())
    ).length;
    return Number((matched / user.size).toFixed(3));
  }

  const overlap = [...user].filter((skill) => job.has(skill)).length;
  return Number((overlap / user.size).toFixed(3));
}

export function computeLocationScore(preferredLocation = "IN", jobLocationNormalized = {}, remoteOk = true) {
  const preferred = normalizePreferredLocation(preferredLocation);
  const jobCountry = jobLocationNormalized?.country || "";
  const jobIsRemote = Boolean(jobLocationNormalized?.isRemote);

  if (preferred === "REMOTE") {
    return jobIsRemote ? 1 : 0;
  }

  if (jobCountry === preferred) return 1;
  if (remoteOk && jobIsRemote) return 0.9;
  return 0;
}

export function isStrictLocationMatch(preferredLocation = "IN", jobLocationNormalized = {}, remoteOk = true) {
  const preferred = normalizePreferredLocation(preferredLocation);
  const jobCountry = jobLocationNormalized?.country || "";
  const jobIsRemote = Boolean(jobLocationNormalized?.isRemote);

  console.log(`🔍 Location check: preferred=${preferred}, jobCountry=${jobCountry}, jobIsRemote=${jobIsRemote}, remoteOk=${remoteOk}`);

  if (preferred === "REMOTE") {
    const result = jobIsRemote;
    console.log(`📍 REMOTE check: ${result ? "PASS" : "FAIL"} (jobIsRemote=${jobIsRemote})`);
    return result;
  }

  if (jobCountry === preferred) {
    console.log(`📍 COUNTRY match: PASS (${jobCountry} === ${preferred})`);
    return true;
  }

  if (remoteOk && jobIsRemote) {
    console.log(`📍 REMOTE OK: PASS (remoteOk=${remoteOk} && jobIsRemote=${jobIsRemote})`);
    return true;
  }

  console.log(`📍 Location check: FAIL (no match found)`);
  return false;
}

export function evaluateHardFilters(job, profile) {
   console.log(`🔍 DEBUG description length: ${job.description?.length || 0}, tags: ${JSON.stringify(job.tags?.slice(0,3))}`);
  console.log(`🔍 USER SKILLS raw:`, profile.skills);
console.log(`🔍 USER SKILLS normalized:`, normalizeSkills(profile.skills));
   const roleScore = computeRoleScore(profile.role, job.title, job.description);
  const skillScore = computeSkillScore(
    profile.skills,
    job.skillsExtracted || job.tags || [],
    job.description || ""   // ✅ description fallback
  );
  const locationScore = computeLocationScore(
    profile.preferredLocation || profile.location || "IN",
    job.locationNormalized || {},
    Boolean(profile.remoteOk)
  );
  const locationMatched = isStrictLocationMatch(
    profile.preferredLocation || profile.location || "IN",
    job.locationNormalized || {},
    Boolean(profile.remoteOk)
  );

  const rejectReasons = [];

  const preferredLocation = profile.preferredLocation || profile.location || "IN";
  console.log(`\n🏢 Job: ${job.title} @ ${job.company}`);
  console.log(`📍 Location: ${job.location}`);
  console.log(`🌍 Normalized: country=${job.locationNormalized?.country}, isRemote=${job.locationNormalized?.isRemote}`);
  console.log(`🎯 Preferred: ${preferredLocation}`);
  console.log(`📊 Scores: role=${roleScore}, skill=${skillScore}, location=${locationScore}`);

  if (!locationMatched) {
    rejectReasons.push("LOCATION_MISMATCH");
    console.log(`❌ REJECTED: LOCATION_MISMATCH`);
  }

  // ✅ Relaxed thresholds
  if (roleScore < 0.05) {
    rejectReasons.push("LOW_ROLE_SCORE");
    console.log(`❌ REJECTED: LOW_ROLE_SCORE (${roleScore} < 0.08)`);
  }
  // if (skillScore < 0.1) {
  //   rejectReasons.push("LOW_SKILL_SCORE");
  //   console.log(`❌ REJECTED: LOW_SKILL_SCORE (${skillScore} < 0.1)`);
  // }
  if (locationScore < 0.4) {
    rejectReasons.push("LOW_LOCATION_SCORE");
    console.log(`❌ REJECTED: LOW_LOCATION_SCORE (${locationScore} < 0.4)`);
  }
  if (Date.now() - new Date(job.postedAt).getTime() > 21 * 24 * 60 * 60 * 1000) {
    rejectReasons.push("STALE_JOB");
    console.log(`❌ REJECTED: STALE_JOB`);
  }
  if (job.language && job.language !== "en") {
    rejectReasons.push("NON_ENGLISH_JOB");
    console.log(`❌ REJECTED: NON_ENGLISH_JOB`);
  }

  if (rejectReasons.length === 0) {
    console.log(`✅ PASSED all filters`);
  }

  return {
    passed: rejectReasons.length === 0,
    roleScore,
    skillScore,
    locationScore,
    rejectReasons,
  };
}