export function logInfo(event, payload = {}) {
  console.log(
    JSON.stringify({
      level: "info",
      event,
      ts: new Date().toISOString(),
      ...payload
    })
  );
}

export function logWarn(event, payload = {}) {
  console.warn(
    JSON.stringify({
      level: "warn",
      event,
      ts: new Date().toISOString(),
      ...payload
    })
  );
}

export function logError(event, payload = {}) {
  console.error(
    JSON.stringify({
      level: "error",
      event,
      ts: new Date().toISOString(),
      ...payload
    })
  );
}
