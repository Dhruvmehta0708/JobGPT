import Job from "../models/Job.js";

export async function upsertJobs(jobs = []) {
  if (!jobs.length) return;
  const ops = jobs.map((job) => ({
    updateOne: {
      filter: { dedupeHash: job.dedupeHash },
      update: {
        $set: {
          ...job,
          sourceLastSeenAt: new Date()
        },
        $setOnInsert: {
          createdAt: new Date()
        }
      },
      upsert: true
    }
  }));
  await Job.bulkWrite(ops, { ordered: false });
}

export async function getRecentJobs({ location = "India", preferredLocation = "IN", days = 21 } = {}) {
  const postedAfter = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const query = {
    postedAt: { $gte: postedAfter },
    language: "en"
  };

  if (preferredLocation === "IN" || String(location).toLowerCase().includes("india")) {
    query.$or = [
      { "locationNormalized.country": "IN" },
      { "locationNormalized.isRemote": true },
      { location: { $regex: "remote", $options: "i" } },
      { location: { $regex: "india", $options: "i" } }
    ];
  } else if (preferredLocation === "US") {
    query.$or = [{ "locationNormalized.country": "US" }, { "locationNormalized.isRemote": true }];
  } else if (preferredLocation === "DE") {
    query.$or = [{ "locationNormalized.country": "DE" }, { "locationNormalized.isRemote": true }];
  } else if (preferredLocation === "REMOTE") {
    query["locationNormalized.isRemote"] = true;
  }

  return Job.find(query).sort({ postedAt: -1 }).limit(500).lean();
}

export async function getJobById(id) {
  return Job.findById(id).lean();
}
