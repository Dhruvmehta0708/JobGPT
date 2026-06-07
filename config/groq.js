import dotenv from "dotenv";
dotenv.config();

import Groq from "groq-sdk";

export function getGroq() {
  if (!process.env.GROQ_API_KEY) {
    console.error("❌ GROQ_API_KEY missing in .env");
  }
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}

export default getGroq;