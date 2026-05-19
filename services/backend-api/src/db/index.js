/**
 * backend-api/src/db/index.js
 * PostgreSQL connection pool
 */
const { Pool } = require("pg");
const config   = require("../config");
const { createLogger } = require("../utils/logger");

const logger = createLogger("db");

const pool = new Pool({
  host:     config.postgres.host,
  port:     config.postgres.port,
  database: config.postgres.database,
  user:     config.postgres.user,
  password: config.postgres.password,
  max:      10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on("error", (err) => logger.error(`Unexpected DB error: ${err.message}`));

async function query(text, params) {
  const start = Date.now();
  const res   = await pool.query(text, params);
  logger.debug(`query [${Date.now() - start}ms] rows=${res.rowCount}`);
  return res;
}

async function initialize() {
  const fs   = require("fs");
  const path = require("path");
  const sql  = fs.readFileSync(path.join(__dirname, "migrations", "001_init.sql"), "utf8");
  await pool.query(sql);
  logger.info("Database schema initialized");
}

module.exports = { query, pool, initialize };
