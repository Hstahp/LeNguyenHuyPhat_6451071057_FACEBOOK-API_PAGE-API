/** backend-api/src/utils/logger.js */
const COLORS = { reset:"\x1b[0m", info:"\x1b[36m", warn:"\x1b[33m", error:"\x1b[31m", debug:"\x1b[90m" };
function createLogger(service) {
  const fmt = (l, m) =>
    `${COLORS[l]||COLORS.reset}[${new Date().toISOString()}] [${service.toUpperCase()}] [${l.toUpperCase()}] ${m}${COLORS.reset}`;
  return {
    info:  m => console.log(fmt("info",  m)),
    warn:  m => console.warn(fmt("warn",  m)),
    error: m => console.error(fmt("error", m)),
    debug: m => console.log(fmt("debug", m)),
  };
}
module.exports = { createLogger };
