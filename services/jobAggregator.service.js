import axios from "axios";
import { normalizeJob } from "./normalizer.service.js";
import { logInfo, logWarn } from "../utils/logger.js";

function buildAdzunaKeywords(role = "Software Engineer", preferredLocation = "IN") {
  const location = String(preferredLocation || "IN").toUpperCase();
  
  if (location === "IN") {
    return [`${role} India`, `${role} Bengaluru`, `${role} Remote India`];
  }
  if (location === "US") {
    return [`${role} USA`, `${role} United States`, `${role} Remote USA`];
  }
  if (location === "DE") {
    return [`${role} Germany`, `${role} Berlin`, `${role} Remote Germany`];
  }
  if (location === "REMOTE") {
    return [`${role} Remote`, `${role} Work from home`];
  }
  
  // Default fallback
  return [`${role} India`, `${role} Bengaluru`, `${role} Remote India`];
}

function formatSalary(salaryMin, salaryMax) {
  if (!salaryMin && !salaryMax) return "";
  if (salaryMin && salaryMax) return `${Math.round(salaryMin)} - ${Math.round(salaryMax)} INR`;
  return `${Math.round(salaryMin || salaryMax)} INR`;
}

export async function fetchAdzunaJobs({ role, location = "India", resultsPerPage = 50, preferredLocation = "IN" }) {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;

  if (!appId || !appKey) {
    logWarn("adzuna_missing_credentials", { hasAppId: Boolean(appId), hasAppKey: Boolean(appKey) });
    return [];
  }

  const keywords = buildAdzunaKeywords(role, preferredLocation);
  const country = getAdzunaCountry(preferredLocation);
  
  logInfo("adzuna_query_keywords", { role, location, preferredLocation, country, keywords, resultsPerPage });
  
  const calls = keywords.map((what) =>
    axios.get(`https://api.adzuna.com/v1/api/jobs/${country}/search/1`, {
      params: {
        app_id: appId,
        app_key: appKey,
        what,
        where: location || getDefaultLocation(preferredLocation),
        results_per_page: Math.min(resultsPerPage, 50),
        sort_by: "date"
      },
      timeout: 20000
    })
  );

  const responses = await Promise.allSettled(calls);
  responses.forEach((entry, index) => {
    if (entry.status === "fulfilled") {
      logInfo("adzuna_raw_response", {
        keyword: keywords[index],
        count: entry.value?.data?.results?.length || 0
      });
    } else {
      logWarn("adzuna_request_failed", { keyword: keywords[index], reason: entry.reason?.message || "unknown" });
    }
  });

  const jobs = responses.flatMap((entry) => {
    if (entry.status !== "fulfilled") return [];
    const items = entry.value?.data?.results || [];
    return items.map((item) =>
      normalizeJob({
        source: "adzuna",
        sourceJobId: item.id,
        title: item.title,
        company: item.company?.display_name,
        url: item.redirect_url,
        location: item.location?.display_name || item.location?.area?.join(", "),
        description: item.description,
        postedAt: item.created,
        salary: formatSalary(item.salary_min, item.salary_max)
      })
    );
  });
  
  // 🔍 STEP 1: AFTER API FETCH
  console.log("🔍 FETCHED JOBS:", jobs.length);
  console.log("🔍 API COUNTRY:", country);
  console.log("🔍 KEYWORDS:", keywords);
  
  // 🔍 STEP 2: RAW JOB SAMPLE
  if (jobs.length > 0) {
    console.log("🔍 RAW JOB 0:", {
      title: jobs[0].title,
      location: jobs[0].location,
      locationNormalized: jobs[0].locationNormalized,
      description: jobs[0].description?.substring(0, 100) + "..."
    });
    if (jobs.length > 1) {
      console.log("🔍 RAW JOB 1:", {
        title: jobs[1].title,
        location: jobs[1].location,
        locationNormalized: jobs[1].locationNormalized,
        description: jobs[1].description?.substring(0, 100) + "..."
      });
    }
  } else {
    console.log("🔍 NO JOBS FETCHED FROM API");
  }
  
  logInfo("adzuna_total_normalized_jobs", { count: jobs.length, preferredLocation, country });

  return jobs;
}

function getAdzunaCountry(preferredLocation = "IN") {
  const location = String(preferredLocation || "IN").toUpperCase();
  if (location === "US") return "us";
  if (location === "DE") return "de";
  if (location === "REMOTE") return "us"; // Use US for remote as fallback
  return "in"; // Default to India
}

function getDefaultLocation(preferredLocation = "IN") {
  const location = String(preferredLocation || "IN").toUpperCase();
  if (location === "US") return "USA";
  if (location === "DE") return "Germany";
  if (location === "REMOTE") return "Remote";
  return "India";
}

export async function fetchFreshJobs(profile) {
  const preferredLocation = profile.preferredLocation || profile.wants?.location || "IN";
  
  const adzunaJobs = await fetchAdzunaJobs({
    role: profile.role,
    location: profile.location || "India",
    preferredLocation,
    resultsPerPage: 50
  });
  
  logInfo("fresh_jobs_fetched", { count: adzunaJobs.length, preferredLocation });
  return adzunaJobs;
}
