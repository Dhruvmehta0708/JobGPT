import User from "../models/User.js";
import UserJob from "../models/UserJob.js";

export const updateUserJob = async (req, res) => {
  const { jobId, email } = req.params;
  const { isSaved, status } = req.body;

  const user = await User.findOne({ email });

  let record = await UserJob.findOne({
    userId: user._id,
    jobId
  });

  if (!record) {
    record = await UserJob.create({
      userId: user._id,
      jobId,
      isSaved,
      status
    });
  } else {
    if (isSaved !== undefined) record.isSaved = isSaved;
    if (status) record.status = status;

    await record.save();
  }

  res.json({ success: true, record });
};