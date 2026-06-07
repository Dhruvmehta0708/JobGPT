import mongoose from "mongoose";

const jobSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  source: String,
  title: String,
  company: String,
  url: String,
  location: String,
  salary: String,
  tags: [String],
  description: String,

  sptClass: String,
  ruleScore: Number,
  aiScore: Number,
  totalScore: Number,

  aiSummary: String,

  // 🔥 NEW FIELDS
  whyFit: String,
  missingSkills: [String],
  suggestion: String,

  // New normalized fields for production matching pipeline
  sourceJobId: String,
  titleNormalized: String,
  locationNormalized: {
    text: String,
    normalized: String,
    country: String,
    city: String,
    isRemote: Boolean
  },
  skillsExtracted: [String],
  language: { type: String, default: "en" },
  qualityFlags: {
    hasSalary: Boolean,
    hasDescription: Boolean
  },
  dedupeHash: { type: String, unique: true, sparse: true },
  sourceLastSeenAt: Date,
  postedAt: Date,
  match: {
    roleScore: Number,
    skillScore: Number,
    locationScore: Number,
    aiScore: Number,
    aiReason: String,
    reasons: [String],
    rejectReasons: [String]
  },
  fetchedAt: { type: Date, default: Date.now }
});

jobSchema.index({ userId: 1, totalScore: -1, fetchedAt: -1 });
jobSchema.index({ userId: 1, sptClass: 1, fetchedAt: -1 });
jobSchema.index({ userId: 1, company: 1 });
jobSchema.index({ userId: 1, title: 1 });
jobSchema.index({ dedupeHash: 1 }, { unique: true, sparse: true });
jobSchema.index({ "locationNormalized.country": 1, postedAt: -1 });
jobSchema.index({ title: "text", description: "text" });

export default mongoose.model("Job", jobSchema);