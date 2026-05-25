/**
 * retry-service/src/index.js
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });



const http          = require("http");
const { createLogger } = require("./utils/logger");
const retryConsumer = require("./consumers/retryConsumer");
const producer      = require("./producers/deadLetterProducer");

const logger = createLogger("retry-service");
const PORT   = process.env.RETRY_SERVICE_PORT || 3003;

const server = http.createServer((req, res) => {
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ service: "retry-service", status: "ok", port: PORT }));
  } else {
    res.writeHead(404); res.end();
  }
});

async function main() {
  try {
    await retryConsumer.start();
    server.listen(PORT, () => logger.info(`retry-service running on port ${PORT}`));
  } catch (err) {
    logger.error(`Startup failed: ${err.message}`);
    process.exit(1);
  }
}

async function shutdown(signal) {
  logger.info(`${signal} — shutting down`);
  await retryConsumer.stop();
  await producer.disconnect();
  server.close(() => process.exit(0));
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

main();
