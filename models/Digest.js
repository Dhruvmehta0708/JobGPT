import mongoose from "mongoose";

const digestSchema = new mongoose.Schema({
  userId:   mongoose.Schema.Types.ObjectId,
  email:    String,
  jobCount: Number,
  targets:  Number,
  sentAt:   { type: Date, default: Date.now }
});

const Digest = mongoose.model("Digest", digestSchema);

export default Digest;
