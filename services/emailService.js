import nodemailer from "nodemailer";
import Digest from "../models/Digest.js";

// ─── HTML Card Builder ────────────────────────────────────────────────────────

function buildCard(job, bgColor, textColor) {
  return `
    <div style="border:1px solid #e2e8f0;border-radius:10px;padding:18px;margin-bottom:14px;">
      <strong style="color:#1a202c;">${job.title}</strong>
      <span style="background:${bgColor};color:${textColor};padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;float:right;">
        ${job.sptClass} · ${job.totalScore}/100
      </span>
      <p style="margin:8px 0 4px;color:#4a5568;">${job.company} · ${job.location}</p>
      ${job.salary ? `<p style="color:#38a169;font-size:13px;">💰 ${job.salary}</p>` : ""}
      ${
        job.aiSummary
          ? `<p style="color:#718096;font-size:13px;border-left:3px solid #667eea;padding-left:10px;">${job.aiSummary}</p>`
          : ""
      }
      <a href="${job.url}" style="background:#667eea;color:white;padding:8px 18px;border-radius:6px;text-decoration:none;font-size:13px;">
        Apply Now →
      </a>
    </div>`;
}

function buildEmailHtml(user, targets, prospects) {
  return `
    <div style="font-family:sans-serif;max-width:620px;margin:auto;padding:28px;">
      <h2 style="color:#667eea;">Hey ${user.name || "there"} 👋</h2>
      <p>Found <strong>${targets.length} Targets</strong> + <strong>${prospects.length} Prospects</strong></p>
      ${
        targets.length > 0
          ? `<h3 style="color:#276749;">🎯 Targets</h3>
             ${targets.map((j) => buildCard(j, "#f0fff4", "#276749")).join("")}`
          : ""
      }
      ${
        prospects.length > 0
          ? `<h3 style="color:#2b6cb0;">👀 Prospects</h3>
             ${prospects.slice(0, 5).map((j) => buildCard(j, "#ebf8ff", "#2b6cb0")).join("")}`
          : ""
      }
    </div>`;
}

// ─── Send Digest ──────────────────────────────────────────────────────────────

export async function sendDigest(user, saved) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;

  const targets   = saved.targets   || [];
  const prospects = saved.prospects || [];
  if (targets.length + prospects.length === 0) return;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from:    `"Job Agent 🤖" <${process.env.EMAIL_USER}>`,
    to:      user.email,
    subject: `🎯 ${targets.length} Target Jobs Found!`,
    html:    buildEmailHtml(user, targets, prospects),
  });

  await Digest.create({
    userId:   user._id,
    email:    user.email,
    jobCount: targets.length + prospects.length,
    targets:  targets.length,
  });

  console.log(`📧 Digest sent to ${user.email}`);
}
