/**
 * Validates that all required environment variables are present.
 * Call this BEFORE connecting to any external services.
 * Exits the process immediately if anything is missing.
 */

const REQUIRED = [
  "MONGO_URI",
  "GROQ_API_KEY",
  "ADZUNA_APP_ID",
  "ADZUNA_APP_KEY",
];

const OPTIONAL = [
  "EMAIL_USER",
  "EMAIL_PASS",
  "NODE_ENV",
  "PORT",
  // Optional: US federal jobs (https://developer.usajobs.gov/)
  "USAJOBS_API_KEY",
  "USAJOBS_EMAIL",
];

export function validateEnv() {
  const missing = REQUIRED.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(`\n❌ Missing required environment variables:\n  ${missing.join("\n  ")}`);
    console.error("\nCheck your .env file and try again.\n");
    process.exit(1);
  }

  const missingOptional = OPTIONAL.filter((key) => !process.env[key]);
  if (missingOptional.length > 0) {
    console.warn(`⚠️  Optional env vars not set: ${missingOptional.join(", ")}`);
  }

  console.log("✅ Environment validated");
}
