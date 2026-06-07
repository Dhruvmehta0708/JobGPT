import UserJob from "../models/UserJob.js";

// ⭐ Save / Unsave
export const toggleSaveJob = async (userId, jobId) => {
  let record = await UserJob.findOne({ userId, jobId });

  if (!record) {
    record = await UserJob.create({ userId, jobId, isSaved: true });
  } else {
    record.isSaved = !record.isSaved;
    await record.save();
  }

  return record;
};

// 📌 Change status
export const updateJobStatus = async (userId, jobId, status) => {
  let record = await UserJob.findOne({ userId, jobId });

  if (!record) {
    record = await UserJob.create({ userId, jobId, status });
  } else {
    record.status = status;
    await record.save();
  }

  return record;
};