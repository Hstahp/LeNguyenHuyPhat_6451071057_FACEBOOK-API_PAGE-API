/**
 * backend-api/src/routes/health.js
 */
const router = require("express").Router();
const fbApi  = require("../services/facebookApiService");

router.get("/", (_req, res) => {
  res.json({
    service: "backend-api",
    status:  "ok",
    facebook_circuit_breaker: fbApi.getCircuitBreakerState(),
    uptime:  process.uptime(),
    ts:      new Date().toISOString(),
  });
});

module.exports = router;
