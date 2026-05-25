/**
 * backend-api/src/routes/blacklist.js
 */
const router       = require("express").Router();
const blacklistSvc = require("../services/blacklistService");

// GET /api/blacklist
router.get("/", async (_req, res) => {
  try {
    const list = await blacklistSvc.getAll();
    res.json({ count: list.length, blacklist: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/blacklist  { userId, pageId, reason }
router.post("/", async (req, res) => {
  try {
    const { userId, pageId, reason } = req.body;
    if (!userId) return res.status(400).json({ error: "userId is required" });
    const entry = await blacklistSvc.add(userId, pageId, reason);
    res.status(201).json({ message: "User blacklisted", entry });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/blacklist/:userId
router.delete("/:userId", async (req, res) => {
  try {
    const entry = await blacklistSvc.remove(req.params.userId);
    if (!entry) return res.status(404).json({ error: "User not found in blacklist" });
    res.json({ message: "User removed from blacklist", entry });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
