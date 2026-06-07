const INDIAN_CITIES = [
  "bengaluru",
  "bangalore",
  "hyderabad",
  "pune",
  "mumbai",
  "delhi",
  "gurgaon",
  "gurugram",
  "noida",
  "chennai",
  "kolkata",
  "ahmedabad",
  "kochi"
];

const USA_CITIES = ["new york", "california", "texas", "seattle", "austin", "san francisco", "boston", "chicago"];
const USA_MARKERS = ["usa", "united states", "us", ...USA_CITIES];
const GERMANY_CITIES = ["berlin", "munich", "hamburg", "frankfurt", "cologne", "stuttgart"];
const GERMANY_MARKERS = ["germany", "deutschland", ...GERMANY_CITIES];
const REMOTE_MARKERS = ["remote", "work from home", "wfh", "anywhere", "fully remote", "remote only"];

export function normalizeLocationText(location = "") {
  return String(location).toLowerCase().replace(/\s+/g, " ").trim();
}

export function isIndiaLocation(location = "") {
  const normalized = normalizeLocationText(location);
  if (!normalized) return false;
  if (normalized.includes("india")) return true;
  return INDIAN_CITIES.some((city) => normalized.includes(city));
}

export function isUsLocation(location = "") {
  const normalized = normalizeLocationText(location);
  return USA_MARKERS.some((marker) => normalized.includes(marker));
}

export function isGermanyLocation(location = "") {
  const normalized = normalizeLocationText(location);
  return GERMANY_MARKERS.some((marker) => normalized.includes(marker));
}

export function isRemoteLocation(location = "") {
  const normalized = normalizeLocationText(location);
  return REMOTE_MARKERS.some((marker) => normalized.includes(marker));
}

export function normalizePreferredLocation(value = "") {
  const normalized = normalizeLocationText(value);
  
  // Check for remote first (as it might be combined with locations)
  if (normalized.includes("remote") || normalized.includes("work from home") || normalized.includes("wfh") || normalized.includes("anywhere")) {
    return "REMOTE";
  }
  
  // US locations
  if (normalized === "usa" || normalized === "us" || normalized === "united states" || USA_MARKERS.some(marker => normalized.includes(marker))) {
    return "US";
  }
  
  // Germany locations
  if (normalized === "germany" || normalized === "deutschland" || normalized === "de" || GERMANY_MARKERS.some(marker => normalized.includes(marker))) {
    return "DE";
  }
  
  // Default to India for any other value or empty string
  return "IN";
}

export function locationToStructured(location = "") {
  const normalized = normalizeLocationText(location);
  
  // Check for remote first
  const isRemote = isRemoteLocation(location);
  
  // Check each location type
  const isIndia = isIndiaLocation(location);
  const isUS = isUsLocation(location);
  const isDE = isGermanyLocation(location);
  
  // Determine city
  let city = "";
  if (isIndia) {
    city = INDIAN_CITIES.find((c) => normalized.includes(c)) || "";
  } else if (isUS) {
    city = USA_CITIES.find((c) => normalized.includes(c)) || "";
  } else if (isDE) {
    city = GERMANY_CITIES.find((c) => normalized.includes(c)) || "";
  }
  
  // Determine country - ensure it's never empty when we have a valid location
  let country = "";
  if (isRemote && !isIndia && !isUS && !isDE) {
    // Pure remote without country indication
    country = "";
  } else if (isIndia) {
    country = "IN";
  } else if (isUS) {
    country = "US";
  } else if (isDE) {
    country = "DE";
  } else if (normalized.length > 0) {
    // If we have some location text but couldn't classify it, don't set country
    country = "";
  }
  
  return {
    text: location || "",
    normalized,
    country,
    city,
    state: "",
    isRemote
  };
}

export function locationSimilarity(userLocation = "India", jobLocation = "") {
  const user = normalizeLocationText(userLocation || "india");
  const job = normalizeLocationText(jobLocation);

  if (!job) return 0;
  if (job.includes("remote") && user.includes("india")) return 1;
  if (user.includes("remote") && job.includes("remote")) return 1;
  if (user === "india" && isIndiaLocation(job)) return 1;
  if (job.includes(user)) return 1;
  if (isIndiaLocation(user) && isIndiaLocation(job)) return 0.8;
  return 0.2;
}
