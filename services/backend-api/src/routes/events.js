/**
 * backend-api/src/routes/events.js
 * GET /api/events — list events by status
 */
const router       = require("express").Router();
const eventTracker = require("../services/eventTracker");

// GET /api/events?status=processed&limit=50
router.get("/", async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;
    const events = status
      ? await eventTracker.findByStatus(status, parseInt(limit))
      : await eventTracker.findAll(parseInt(limit));
    res.json({ count: events.length, events });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
