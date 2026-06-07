import mongoose from "mongoose";
import User from "../models/User.js";
import Job from "../models/Job.js";
import UserJob from "../models/UserJob.js";
import { runAgentForUser } from "../services/agentService.js";
import { catchAsync } from "../middleware/catchAsync.js";
import { AppError } from "../middleware/errorHandler.js";

const ALLOWED_SORT_FIELDS = new Set(["totalScore", "fetchedAt", "company", "title"]);

// ─── Helper ─────────────────────────────────────────
async function requireUser(email) {
  const user = await User.findOne({ email });
  if (!user) throw new AppError("User not found. Register first.", 404);
  return user;
}

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// ─── GET JOBS ───────────────────────────────────────
export const getJobs = catchAsync(async (req, res) => {
  const user = await requireUser(req.params.email);
  const page = toPositiveInt(req.query.page, 1);
  const limit = Math.min(toPositiveInt(req.query.limit, 20), 100);
  const sortBy = ALLOWED_SORT_FIELDS.has(req.query.sortBy) ? req.query.sortBy : "totalScore";
  const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;
  const tab = req.query.tab;
  const status = req.query.status;
  const saved =
    req.query.saved === "true" ? true : req.query.saved === "false" ? false : undefined;
  const q = (req.query.q || "").trim();

  const match = { userId: user._id };
  if (tab && ["Target", "Prospect", "Suspect"].includes(tab)) {
    match.sptClass = tab;
  }
  if (q) {
    match.$or = [
      { title: { $regex: q, $options: "i" } },
      { company: { $regex: q, $options: "i" } },
      { location: { $regex: q, $options: "i" } },
      { tags: { $regex: q, $options: "i" } }
    ];
  }

  const userObjectId = user._id;
  const basePipeline = [
    { $match: match },
    {
      $lookup: {
        from: "userjobs",
        let: { jobId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$jobId", "$$jobId"] }, { $eq: ["$userId", userObjectId] }]
              }
            }
          },
          { $limit: 1 }
        ],
        as: "userJob"
      }
    },
    {
      $addFields: {
        userJob: { $arrayElemAt: ["$userJob", 0] },
        isSaved: { $ifNull: [{ $arrayElemAt: ["$userJob.isSaved", 0] }, false] },
        status: { $ifNull: [{ $arrayElemAt: ["$userJob.status", 0] }, "not_applied"] }
      }
    }
  ];

  if (typeof saved === "boolean") {
    basePipeline.push({ $match: { isSaved: saved } });
  }
  if (status && ["not_applied", "applied", "interview", "rejected"].includes(status)) {
    basePipeline.push({ $match: { status } });
  }

  const [pageData] = await Job.aggregate([
    ...basePipeline,
    { $sort: { [sortBy]: sortOrder, _id: -1 } },
    {
      $facet: {
        data: [{ $skip: (page - 1) * limit }, { $limit: limit }],
        totalCount: [{ $count: "count" }]
      }
    }
  ]);

  const summary = await Job.aggregate([
    ...basePipeline,
    {
      $group: {
        _id: "$sptClass",
        count: { $sum: 1 }
      }
    }
  ]);

  const jobsWithUserData = pageData?.data || [];
  const total = pageData?.totalCount?.[0]?.count || 0;

  const grouped = {
    targets: jobsWithUserData.filter((j) => j.sptClass === "Target"),
    prospects: jobsWithUserData.filter((j) => j.sptClass === "Prospect"),
    suspects: jobsWithUserData.filter((j) => j.sptClass === "Suspect")
  };

  const summaryByClass = (summary || []).reduce(
    (acc, row) => {
      if (row._id === "Target") acc.targets = row.count;
      if (row._id === "Prospect") acc.prospects = row.count;
      if (row._id === "Suspect") acc.suspects = row.count;
      return acc;
    },
    { targets: 0, prospects: 0, suspects: 0 }
  );

  res.json({
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    summary: summaryByClass,
    jobs: grouped,
    jobsFlat: jobsWithUserData,
    filters: {
      q,
      tab: tab || "all",
      status: status || "all",
      saved: typeof saved === "boolean" ? saved : "all",
      sortBy,
      sortOrder: sortOrder === 1 ? "asc" : "desc"
    },
  });
});

// ─── GET ONE JOB (deep link / detail view) ─────────
export const getJobById = catchAsync(async (req, res) => {
  const user = await requireUser(req.params.email);
  const { jobId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(jobId)) {
    throw new AppError("Invalid job id", 400);
  }

  const job = await Job.findOne({ _id: jobId, userId: user._id }).lean();
  if (!job) {
    throw new AppError("Job not found", 404);
  }

  const userJob = await UserJob.findOne({ userId: user._id, jobId }).lean();

  res.json({
    job: {
      ...job,
      isSaved: userJob?.isSaved ?? false,
      status: userJob?.status ?? "not_applied",
    },
  });
});

// ─── DELETE JOBS (✅ OUTSIDE FUNCTION) ──────────────
export const deleteJobs = catchAsync(async (req, res) => {
  const user = await requireUser(req.params.email);

  await Job.deleteMany({ userId: user._id });
  await UserJob.deleteMany({ userId: user._id });

  res.json({ success: true, message: "Jobs cleared!" });
});

export const resetMemory = (req, res) => {
  res.json({
    success: true,
    message: "No in-memory state is used anymore. Pagination and filters control visibility."
  });
};



// ─── FETCH JOBS (AGENT TRIGGER) ─────────────────────
export const triggerFetch = catchAsync(async (req, res) => {
  const user = await requireUser(req.params.email);

  const saved = await runAgentForUser(user);

  res.json({
    success: true,
    summary: {
      targets: saved.targets.length,
      prospects: saved.prospects.length,
      suspects: saved.suspects.length,
    },
  });
});