# Job Agent 🤖

An AI-powered job discovery agent that fetches, scores, and emails personalized job listings.

---

## Folder Structure

```
job-agent/
├── server.js                    ← App entry: Express setup, middleware, cron
│
├── .env.example                 ← Copy to .env and fill in values
│
├── config/
│   ├── db.js                    ← Mongoose connection
│   └── groq.js                  ← Groq SDK singleton
│
├── models/
│   ├── User.js                  ← User preferences schema
│   ├── Job.js                   ← Fetched & scored job schema
│   └── Digest.js                ← Email send history schema
│
├── services/                    ← All business logic lives here
│   ├── fetchService.js          ← Remotive, Arbeitnow, Adzuna APIs + dedup
│   ├── scoringService.js        ← Rule-based score, Groq AI score, SPT classify
│   ├── emailService.js          ← HTML email builder + nodemailer sender
│   └── agentService.js          ← Orchestrates fetch → score → persist
│
├── controllers/                 ← Thin HTTP layer; no business logic
│   ├── userController.js        ← POST /register
│   ├── jobController.js         ← POST /fetch/:email, GET/DELETE /jobs/:email
│   └── analyticsController.js   ← GET /analytics
│
├── routes/
│   ├── userRoutes.js
│   ├── jobRoutes.js
│   └── analyticsRoutes.js
│
└── middleware/
    ├── catchAsync.js            ← Wraps async controllers; removes try/catch noise
    ├── errorHandler.js          ← Global error handler + AppError class
    ├── requestLogger.js         ← Colourised method/path/status/duration logger
    └── validateEnv.js           ← Fails fast if required env vars are missing
```

---

## API Endpoints

| Method   | Path                  | Description                              |
|----------|-----------------------|------------------------------------------|
| `GET`    | `/`                   | Health check                             |
| `POST`   | `/register`           | Create or update a user profile          |
| `POST`   | `/fetch/:email`       | Run the agent and trigger email digest   |
| `GET`    | `/jobs/:email`        | Get 10 fresh randomised jobs             |
| `DELETE` | `/jobs/:email`        | Clear all stored jobs for a user         |
| `POST`   | `/reset-memory`       | Reset the in-session "shown jobs" set    |
| `GET`    | `/analytics`          | Aggregate stats across all users         |

---

## SPT Classification

| Class      | Score    | Meaning                         |
|------------|----------|---------------------------------|
| 🎯 Target  | 70–100   | Strong match — apply now        |
| 👀 Prospect| 45–69    | Decent fit — worth reviewing    |
| 🔍 Suspect | 0–44     | Weak match — low priority       |

Score = Rule-based (0–50) + Groq AI (0–50)

---

## Setup

```bash
cp .env.example .env
# fill in .env values

npm install
node server.js
```

---

## Design Principles

- **Controllers are dumb** — they validate input, call a service, and return JSON. Nothing else.
- **Services own logic** — fetching, scoring, and emailing are each isolated in their own service with a single responsibility.
- **`catchAsync`** wraps every async controller so errors bubble to the global handler automatically.
- **`AppError`** is the single way to send an expected error response — throw it anywhere, the handler catches it.
- **`validateEnv`** runs at startup and exits immediately if critical config is missing — no silent failures at runtime.
