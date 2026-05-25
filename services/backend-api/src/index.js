/**
 * backend-api/src/index.js
 * Entry point — Express API + Kafka consumers
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const express  = require("express");
const morgan   = require("morgan");
const { createLogger }  = require("./utils/logger");
const db       = require("./db");
const replyConsumer     = require("./consumers/replyCommandsConsumer");
const processedConsumer = require("./consumers/processedEventsConsumer");

const logger = createLogger("backend-api");
const app    = express();
const PORT   = process.env.BACKEND_API_PORT || 3000;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(morgan("dev"));

// ── Routes ──────────────────────────────────────────────────────────────────
app.use("/health",      require("./routes/health"));
app.use("/api/events",  require("./routes/events"));
app.use("/api/blacklist", require("./routes/blacklist"));
app.use("/api/review",  require("./routes/review"));

app.get("/", (_req, res) => res.json({ service: "backend-api", status: "ok", port: PORT }));

// 404 handler
app.use((req, res) => res.status(404).json({ error: `Route ${req.path} not found` }));

// ── Startup ─────────────────────────────────────────────────────────────────
async function main() {
  try {
    // Init DB schema
    await db.initialize();
    logger.info("PostgreSQL connected and schema ready");

    // Start Kafka consumers
    await replyConsumer.start();
    await processedConsumer.start();

    // Start HTTP server
    app.listen(PORT, () => logger.info(`backend-api running on port ${PORT}`));
  } catch (err) {
    logger.error(`Startup failed: ${err.message}`);
    process.exit(1);
  }
}

// ── Graceful Shutdown ────────────────────────────────────────────────────────
async function shutdown(signal) {
  logger.info(`${signal} — shutting down`);
  await replyConsumer.stop();
  await processedConsumer.stop();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

main();
