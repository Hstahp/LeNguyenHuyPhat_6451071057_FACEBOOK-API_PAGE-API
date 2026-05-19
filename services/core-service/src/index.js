/**
 * core-service/src/index.js
 * Entry point — starts the Kafka consumer pipeline
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });



const http = require("http");
const { createLogger }    = require("./utils/logger");
const rawEventsConsumer   = require("./consumers/rawEventsConsumer");

const logger = createLogger("core-service");
const PORT   = process.env.CORE_SERVICE_PORT || 3002;

// Minimal HTTP server for health checks
const server = http.createServer((req, res) => {
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ service: "core-service", status: "ok", port: PORT }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

async function main() {
  try {
    await rawEventsConsumer.start();
    server.listen(PORT, () => logger.info(`core-service running on port ${PORT}`));
  } catch (err) {
    logger.error(`Startup failed: ${err.message}`);
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown(signal) {
  logger.info(`${signal} received — shutting down gracefully`);
  await rawEventsConsumer.stop();
  server.close(() => process.exit(0));
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

main();
