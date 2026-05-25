/**
 * src/utils/logger.js  — local logger (no shared dependency)
 */
const COLORS = {
  reset: "\x1b[0m",
  info:  "\x1b[36m",
  warn:  "\x1b[33m",
  error: "\x1b[31m",
  debug: "\x1b[90m",
};

function createLogger(service) {
  const fmt = (level, msg) => {
    const ts    = new Date().toISOString();
    const color = COLORS[level] || COLORS.reset;
    return `${color}[${ts}] [${service.toUpperCase()}] [${level.toUpperCase()}] ${msg}${COLORS.reset}`;
  };
  return {
    info:  (msg) => console.log(fmt("info",  msg)),
    warn:  (msg) => console.warn(fmt("warn",  msg)),
    error: (msg) => console.error(fmt("error", msg)),
    debug: (msg) => console.log(fmt("debug", msg)),
  };
}

module.exports = { createLogger };
