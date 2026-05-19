/**
 * backend-api/src/routes/review.js
 * Manual review queue management
 */
const router = require("express").Router();
const db     = require("../db");
const fbApi  = require("../services/facebookApiService");

// GET /api/review?status=pending
router.get("/", async (req, res) => {
  try {
    const { status = "pending", limit = 50 } = req.query;
    const result = await db.query(
      "SELECT * FROM manual_review_queue WHERE status=$1 ORDER BY created_at DESC LIMIT $2",
      [status, parseInt(limit)],
    );
    res.json({ count: result.rowCount, items: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/review/:id/approve  — hide comment + mark approved
router.post("/:id/approve", async (req, res) => {
  try {
    const { id } = req.params;
    const item = await db.query("SELECT * FROM manual_review_queue WHERE id=$1", [id]);
    if (!item.rows[0]) return res.status(404).json({ error: "Review item not found" });

    const row = item.rows[0];
    // Execute hide_comment on Facebook
    if (row.comment_id) {
      await fbApi.executeCommand({ action: "hide_comment", commentId: row.comment_id });
    }

    await db.query(
      "UPDATE manual_review_queue SET status='approved', reviewed_at=NOW() WHERE id=$1",
      [id],
    );
    res.json({ message: "Approved and comment hidden", id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/review/:id/reject  — dismiss review item
router.post("/:id/reject", async (req, res) => {
  try {
    const { id } = req.params;
    await db.query(
      "UPDATE manual_review_queue SET status='rejected', reviewed_at=NOW() WHERE id=$1", [id],
    );
    res.json({ message: "Rejected", id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
