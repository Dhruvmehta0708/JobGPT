import crypto from "crypto";
import { extractSkillsFromText, normalizeSkills } from "../utils/skillDictionary.js";
import { locationToStructured } from "../utils/indiaLocationMap.js";

function normalizeText(value = "") {
  return String(value).toLowerCase().replace(/\s+/g, " ").trim();
}

function detectEnglish(text = "") {
  if (!text) return true;
  const latinRatio = (text.match(/[a-zA-Z0-9\s.,:;!?()'"%/-]/g) || []).length / text.length;
  return latinRatio > 0.7;
}

export function normalizeJob(rawJob) {
  const title = rawJob.title || "Untitled role";
  const description = rawJob.description || "";
  const company = rawJob.company || "Unknown company";
  const locationText = rawJob.location || rawJob.locationText || "";
  const postedAt = rawJob.postedAt ? new Date(rawJob.postedAt) : new Date();
  const skills = normalizeSkills([
    ...(Array.isArray(rawJob.skills) ? rawJob.skills : []),
    ...extractSkillsFromText(`${title} ${description}`)
  ]);

  const dedupeBase = `${normalizeText(title)}|${normalizeText(company)}|${normalizeText(locationText)}`;
  const dedupeHash = crypto.createHash("sha256").update(dedupeBase).digest("hex");

  return {
    source: rawJob.source || "adzuna",
    sourceJobId: String(rawJob.sourceJobId || rawJob.id || dedupeHash),
    title,
    titleNormalized: normalizeText(title),
    company,
    url: rawJob.url || "",
    salary: rawJob.salary || "",
    description,
    location: locationText,
    locationNormalized: locationToStructured(locationText),
    skillsExtracted: skills,
    tags: skills,
    language: detectEnglish(`${title} ${description}`) ? "en" : "non-en",
    postedAt,
    fetchedAt: new Date(),
    sourceLastSeenAt: new Date(),
    qualityFlags: {
      hasSalary: Boolean(rawJob.salary),
      hasDescription: description.length >= 40
    },
    dedupeHash
  };
}
