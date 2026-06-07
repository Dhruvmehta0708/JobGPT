import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  email:      { type: String, required: true, unique: true },
  name:       String,
  role:       String,
  skills:     [String],
  experience: String,
  wants: {
    salary:   Boolean,
    startup:  Boolean,
    bigco:    Boolean,
    growth:   Boolean,
    remote:   Boolean,
    onsite:   Boolean,
    location: String,
  },
  createdAt: { type: Date, default: Date.now }
});

// email is already unique:true above — Mongoose auto-creates that index.
// Explicit sparse index for fast role-based lookups (analytics/cron)
userSchema.index({ role: 1 });

const User = mongoose.model("User", userSchema);

export default User;
