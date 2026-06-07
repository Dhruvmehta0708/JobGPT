import User           from "../models/User.js";
import { catchAsync } from "../middleware/catchAsync.js";
import { AppError }   from "../middleware/errorHandler.js";

export const registerUser = catchAsync(async (req, res) => {
  const { email, name, role, skills, experience, wants } = req.body;

  if (!email || !role) throw new AppError("email and role are required", 400);

  const user = await User.findOneAndUpdate(
    { email },
    { name, role, skills, experience, wants },
    { upsert: true, new: true, runValidators: true }
  );

  res.json({ success: true, user });
});
