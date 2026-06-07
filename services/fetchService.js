import axios from "axios";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const stripHtml = (str = "") => str.replace(/<[^>]+>/g, "").slice(0, 400);

// India city mapping for Adzuna
const INDIA_CITIES = ["india", "delhi", "bangalore", "mumbai", "hyderabad", "pune", "chennai", "noida", "gurugram"];

// ─── Remotive ─────────────────────────────────────────────────────────────────
export async function fetchFromRemotive(role, skills) {
  const queries = [role, skills[0] || role, skills[1] || role];
  const results = [];

  for (const q of queries) {
    try {
      const res = await axios.get("https://remotive.io/api/remote-jobs", {
        params: { search: q, limit: 15 },
        timeout: 8000,
      });

      (res.data.jobs || []).forEach((j) => {
        const loc = (j.candidate_required_location || "").toLowerCase();
        // ✅ Include: worldwide, remote, Asia, India, or no restriction
        const isRelevant =
          !loc ||
          loc.includes("worldwide") ||
          loc.includes("remote") ||
          loc.includes("asia") ||
          loc.includes("india") ||
          loc.includes("anywhere");

        if (isRelevant) {
          results.push({
            source:      "remotive",
            title:       j.title,
            company:     j.company_name,
            url:         j.url,
            location:    j.candidate_required_location || "Remote / Worldwide",
            salary:      j.salary || "",
            tags:        j.tags || [],
            description: stripHtml(j.description),
          });
        }
      });
    } catch (e) {
      console.error(`Remotive "${q}" failed:`, e.message);
    }
  }

  return results;
}

// ─── Arbeitnow ────────────────────────────────────────────────────────────────
export async function fetchFromArbeitnow(role, skills) {
  const queries = [role, `${skills[0] || ""} developer`];
  const results = [];

  for (const q of queries) {
    try {
      const res = await axios.get("https://www.arbeitnow.com/api/job-board-api", {
        params: { search: q },
        timeout: 8000,
      });

      (res.data.data || []).slice(0, 10).forEach((j) => {
        results.push({
          source:      "arbeitnow",
          title:       j.title,
          company:     j.company_name,
          url:         j.url,
          location:    j.location || "Remote",
          salary:      "",
          tags:        j.tags || [],
          description: stripHtml(j.description),
        });
      });
    } catch (e) {
      console.error(`Arbeitnow "${q}" failed:`, e.message);
    }
  }

  return results;
}

// ─── Adzuna (Dynamic Location Support) ───────────────────────────────────────────────────
export async function fetchFromAdzuna(role, skills, location) {
  const normalizedLocation = String(location || "india").toLowerCase();
  
  // Determine country and queries based on location
  let country = "in";
  let locationQueries = [];
  
  if (normalizedLocation === "us" || normalizedLocation === "usa") {
    country = "us";
    locationQueries = [
      { what: role, where: "usa" },
      { what: `${role} developer`, where: "usa" },
      { what: `${role} entry level`, where: "usa" },
      { what: skills[0] || role, where: "new york" },
      { what: skills[1] || role, where: "san francisco" },
      { what: `${role} remote`, where: "usa" },
    ];
  } else if (normalizedLocation === "de" || normalizedLocation === "germany") {
    country = "de";
    locationQueries = [
      { what: role, where: "germany" },
      { what: `${role} developer`, where: "germany" },
      { what: `${role} engineer`, where: "berlin" },
      { what: skills[0] || role, where: "berlin" },
      { what: skills[1] || role, where: "munich" },
      { what: `${role} remote`, where: "germany" },
    ];
  } else if (normalizedLocation === "remote") {
    // Use US API for remote jobs as fallback
    country = "us";
    locationQueries = [
      { what: `${role} remote`, where: "usa" },
      { what: `${role} work from home`, where: "usa" },
      { what: `${role} remote`, where: "remote" },
      { what: skills[0] || role, where: "remote" },
      { what: skills[1] || role, where: "remote" },
    ];
  } else {
    // Default to India
    country = "in";
    const userCity = normalizedLocation;
    const targetCity = INDIA_CITIES.includes(userCity) ? userCity : "india";
    locationQueries = [
      { what: role, where: targetCity },
      { what: `${role} fresher`, where: "india" },
      { what: `${role} junior`, where: "india" },
      { what: skills[0] || role, where: "india" },
      { what: skills[1] || role, where: targetCity },
      { what: `${role} entry level`, where: "india" },
    ];
  }

  console.log(`🔍 ADZUNA API: Using country=${country} for location=${location}`);
  console.log(`🔍 ADZUNA QUERIES:`, locationQueries.map(q => ({ what: q.what, where: q.where })));

  const results = [];

  for (const q of locationQueries) {
    try {
      const res = await axios.get(`https://api.adzuna.com/v1/api/jobs/${country}/search/1`, {
        params: {
          app_id:           process.env.ADZUNA_APP_ID,
          app_key:          process.env.ADZUNA_APP_KEY,
          what:             q.what,
          where:            q.where,
          results_per_page: 10,
          content_type:     "application/json",
          sort_by:          "date",   // Latest jobs first
        },
        timeout: 8000,
      });

      console.log(`🔍 ADZUNA RESPONSE: ${res.data?.results?.length || 0} jobs for "${q.what}" in "${q.where}"`);

      (res.data.results || []).forEach((j) =>
        results.push({
          source:      "adzuna",
          title:       j.title,
          company:     j.company?.display_name || "Unknown",
          url:         j.redirect_url,
          location:    j.location?.display_name || q.where,
          salary:      j.salary_min
            ? country === "in" 
              ? `₹${Math.round(j.salary_min).toLocaleString("en-IN")} - ₹${Math.round(j.salary_max).toLocaleString("en-IN")}`
              : country === "us"
              ? `$${Math.round(j.salary_min).toLocaleString("en-US")} - $${Math.round(j.salary_max).toLocaleString("en-US")}`
              : `€${Math.round(j.salary_min).toLocaleString("de-DE")} - €${Math.round(j.salary_max).toLocaleString("de-DE")}`
            : "",
          tags:        [],
          description: (j.description || "").slice(0, 400),
        })
      );
    } catch (e) {
      console.error(`Adzuna "${q.what}" in "${q.where}" (${country}) failed:`, e.message);
    }
  }

  return results;
}

// ─── Adzuna (United States) ───────────────────────────────────────────────────
export async function fetchFromAdzunaUS(role, skills) {
  const queries = [
    { what: role,                  where: "usa" },
    { what: `${role} developer`,  where: "usa" },
    { what: `${role} entry level`, where: "usa" },
    { what: skills[0] || role,      where: "new york" },
    { what: skills[1] || role,     where: "san francisco" },
    { what: `${role} remote`,      where: "usa" },
  ];

  const results = [];

  for (const q of queries) {
    try {
      const res = await axios.get("https://api.adzuna.com/v1/api/jobs/us/search/1", {
        params: {
          app_id:           process.env.ADZUNA_APP_ID,
          app_key:          process.env.ADZUNA_APP_KEY,
          what:             q.what,
          where:            q.where,
          results_per_page: 10,
          content_type:     "application/json",
          sort_by:          "date",
        },
        timeout: 8000,
      });

      (res.data.results || []).forEach((j) =>
        results.push({
          source:      "adzuna_us",
          title:       j.title,
          company:     j.company?.display_name || "Unknown",
          url:         j.redirect_url,
          location:    j.location?.display_name || q.where,
          salary:      j.salary_min
            ? `$${Math.round(j.salary_min).toLocaleString("en-US")} - $${Math.round(j.salary_max).toLocaleString("en-US")}`
            : "",
          tags:        [],
          description: (j.description || "").slice(0, 400),
        })
      );
    } catch (e) {
      console.error(`Adzuna US "${q.what}" in "${q.where}" failed:`, e.message);
    }
  }

  return results;
}

// ─── Remote OK (free public API — remote roles worldwide) ───────────────────
export async function fetchFromRemoteOk(role, skills) {
  try {
    const res = await axios.get("https://remoteok.com/api", {
      timeout: 12000,
      headers: { "User-Agent": "JOB-GPT-Agent/1.0 (job fetch)" },
    });

    const data = res.data;
    if (!Array.isArray(data)) return [];

    const rows = data.filter((row) => row && row.url && (row.position || row.title));
    const terms = [role, ...(skills || []).slice(0, 4)]
      .map((t) => String(t || "").toLowerCase().trim())
      .filter((t) => t.length > 1);

    const scored = rows.map((j) => {
      const hay = `${j.position || ""} ${j.title || ""} ${(j.tags || []).join(" ")}`.toLowerCase();
      const hits = terms.filter((t) => hay.includes(t)).length;
      return { j, hits };
    });

    const hasMatch = scored.some((s) => s.hits > 0);
    const picked = hasMatch
      ? scored
          .filter((s) => s.hits > 0)
          .sort((a, b) => b.hits - a.hits)
          .slice(0, 28)
          .map((s) => s.j)
      : rows.slice(0, 18);

    return picked.map((j) => ({
      source:      "remoteok",
      title:       j.title || j.position,
      company:     j.company || "Company",
      url:         j.url.startsWith("http") ? j.url : `https://remoteok.com${j.url}`,
      location:    j.location || "Remote",
      salary:      typeof j.salary === "string" ? j.salary : "",
      tags:        Array.isArray(j.tags) ? j.tags : [],
      description: stripHtml(String(j.description || "")).slice(0, 400),
    }));
  } catch (e) {
    console.error("Remote OK failed:", e.message);
    return [];
  }
}

// ─── USAJOBS (optional — US federal / public sector; needs API key) ─────────
export async function fetchFromUsajobs(role, skills) {
  const apiKey = process.env.USAJOBS_API_KEY;
  const contactEmail = process.env.USAJOBS_EMAIL;
  if (!apiKey || !contactEmail) return [];

  const keyword = [role, skills[0], skills[1]].filter(Boolean).join(" ").trim().slice(0, 80);
  if (!keyword) return [];

  try {
    const res = await axios.get("https://data.usajobs.gov/api/search", {
      params: {
        Keyword: keyword,
        ResultsPerPage: 25,
      },
      headers: {
        "Authorization-Key": apiKey,
        "User-Agent": contactEmail,
      },
      timeout: 12000,
    });

    const items = res.data?.SearchResult?.SearchResultItems || [];
    return items.map((item) => {
      const d = item.MatchedObjectDescriptor || {};
      const title = d.PositionTitle || "Role";
      const org = d.OrganizationName || "US Government";
      const url = d.PositionURI || "";
      const loc =
        d.PositionLocationDisplay ||
        (d.PositionLocation || []).map((l) => l.LocationName).filter(Boolean).join(", ") ||
        "United States";
      return {
        source:      "usajobs",
        title,
        company:     org,
        url,
        location:    loc,
        salary:      "",
        tags:        ["Government", "US"],
        description: stripHtml(d.UserArea?.Details?.JobSummary || "").slice(0, 400),
      };
    }).filter((j) => j.url);
  } catch (e) {
    console.error("USAJOBS failed:", e.message);
    return [];
  }
}

// ─── Aggregate + Deduplicate ──────────────────────────────────────────────────
export async function fetchAllJobs(user) {
  const skills   = user.skills  || [];
  const preferredLocation = user.preferredLocation || user.wants?.location || "india";
  
  console.log(`🎯 Fetching jobs for location: ${preferredLocation}`);
  console.log(`🔍 USER PROFILE:`, {
    role: user.role,
    preferredLocation,
    wantsLocation: user.wants?.location,
    skills: user.skills?.slice(0, 3)
  });

  const [remotive, arbeitnow, adzunaIn, adzunaUs, remoteOk, usajobs] = await Promise.all([
    fetchFromRemotive(user.role, skills),
    fetchFromArbeitnow(user.role, skills),
    fetchFromAdzuna(user.role, skills, preferredLocation),
    fetchFromAdzunaUS(user.role, skills),
    fetchFromRemoteOk(user.role, skills),
    fetchFromUsajobs(user.role, skills),
  ]);

  const rawTotal =
    remotive.length +
    arbeitnow.length +
    adzunaIn.length +
    adzunaUs.length +
    remoteOk.length +
    usajobs.length;

  console.log(
    `📦 Raw: ${rawTotal} ` +
    `(IN:${adzunaIn.length} US:${adzunaUs.length} RemoteOK:${remoteOk.length} ` +
    `Remotive:${remotive.length} Arbeitnow:${arbeitnow.length} USAJOBS:${usajobs.length}) ` +
    `for location: ${preferredLocation}`
  );
  
  // 🔍 STEP 3: AFTER NORMALIZATION (individual sources)
  console.log(`🔍 SOURCE BREAKDOWN FOR ${preferredLocation}:`);
  console.log(`  - Adzuna IN: ${adzunaIn.length}`);
  console.log(`  - Adzuna US: ${adzunaUs.length}`);
  console.log(`  - RemoteOK: ${remoteOk.length}`);
  console.log(`  - Remotive: ${remotive.length}`);
  console.log(`  - Arbeitnow: ${arbeitnow.length}`);
  console.log(`  - USAJOBS: ${usajobs.length}`);

  const seenUrls      = new Set();
  const seenCompanies = new Set();
  const unique        = [];

  // Order: India → US → global remote → other
  for (const job of [
    ...adzunaIn,
    ...adzunaUs,
    ...remoteOk,
    ...remotive,
    ...arbeitnow,
    ...usajobs,
  ]) {
    if (!job.url || !job.company) continue;
    if (seenUrls.has(job.url)) continue;
    if (seenCompanies.has(job.company.toLowerCase())) continue;
    seenUrls.add(job.url);
    seenCompanies.add(job.company.toLowerCase());
    unique.push(job);
  }

  console.log(`✂️  Unique: ${unique.length} for location: ${preferredLocation}`);
  
  // 🔍 STEP 4: FINAL UNIQUE JOB SAMPLE
  if (unique.length > 0) {
    console.log(`🔍 FINAL UNIQUE JOB 0:`, {
      title: unique[0].title,
      location: unique[0].location,
      source: unique[0].source
    });
  }
  
  return unique;
}