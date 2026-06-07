import User           from "../models/User.js";
import Job            from "../models/Job.js";
import Digest         from "../models/Digest.js";
import { catchAsync } from "../middleware/catchAsync.js";

export const getAnalytics = catchAsync(async (req, res) => {
  const [totalUsers, totalJobs, totalEmails, sptBreakdown, sourceBreakdown, topCompanies] =
    await Promise.all([
      User.countDocuments(),
      Job.countDocuments(),
      Digest.countDocuments(),

      Job.aggregate([
        { $group: { _id: "$sptClass", count: { $sum: 1 }, avgScore: { $avg: "$totalScore" } } },
        { $sort: { avgScore: -1 } },
      ]),

      Job.aggregate([
        { $group: { _id: "$source", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      Job.aggregate([
        { $match: { sptClass: "Target" } },
        { $group: { _id: "$company", count: { $sum: 1 }, avgScore: { $avg: "$totalScore" } } },
        { $sort: { avgScore: -1 } },
        { $limit: 10 },
      ]),
    ]);

  res.json({ totalUsers, totalJobs, totalEmails, sptBreakdown, sourceBreakdown, topCompanies });
});
