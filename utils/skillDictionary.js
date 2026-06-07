const SKILL_ALIASES = {
  restapi: ["rest", "rest api", "api", "restapi", "rest-api"],
  javascript: ["javascript", "js", "ecmascript"],
  typescript: ["typescript", "ts"],
  nodejs: ["node", "nodejs", "node.js"],
  react: ["react", "reactjs", "react.js"],
  mongodb: ["mongodb", "mongo", "mongo db"],
  express: ["express", "expressjs"],
  python: ["python", "py"],
  django: ["django"],
  flask: ["flask"],
  fastapi: ["fastapi", "fast api"],
  sql: ["sql", "mysql", "postgres", "postgresql"],
  aws: ["aws", "amazon web services"],
  docker: ["docker"],
  kubernetes: ["kubernetes", "k8s"],
  git: ["git", "github", "gitlab"],
  restapi: ["rest", "rest api", "api"],
  java: ["java"],
  springboot: ["spring", "springboot", "spring boot"],
  cplusplus: ["c++", "cpp"],
  csharp: ["c#", "dotnet", ".net"],
  golang: ["go", "golang"],
  redis: ["redis"],
  nextjs: ["next", "nextjs", "next.js"]
};

const aliasLookup = Object.entries(SKILL_ALIASES).reduce((acc, [canonical, aliases]) => {
  aliases.forEach((a) => {
    acc[a] = canonical;
  });
  return acc;
}, {});

function cleanToken(value = "") {
  return String(value).toLowerCase().replace(/[^\w+#. ]/g, " ").replace(/\s+/g, " ").trim();
}

export function canonicalizeSkill(skill = "") {
  const normalized = cleanToken(skill);
  return aliasLookup[normalized] || normalized.replace(/\s+/g, "");
}

export function normalizeSkills(skills = []) {
  if (!Array.isArray(skills)) return [];
  return [...new Set(skills.map(canonicalizeSkill).filter(Boolean))];
}

export function extractSkillsFromText(text = "") {
  const haystack = cleanToken(text);
  const matched = [];

  for (const [canonical, aliases] of Object.entries(SKILL_ALIASES)) {
    const hasAlias = aliases.some((alias) => haystack.includes(alias));
    if (hasAlias) matched.push(canonical);
  }

  return matched;
}
