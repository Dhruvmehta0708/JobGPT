import mongoose from "mongoose";

const userJobSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Job",
    required: true
  },
  isSaved: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ["not_applied", "applied", "interview", "rejected"],
    default: "not_applied"
  }
}, { timestamps: true });

userJobSchema.index({ userId: 1, jobId: 1 }, { unique: true });
userJobSchema.index({ userId: 1, status: 1 });
userJobSchema.index({ userId: 1, isSaved: 1 });

export default mongoose.model("UserJob", userJobSchema);