const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { verifyToken, verifyAdmin } = require('../middleware/auth');
const { getDb } = require('../db/connection');

// Get all announcements (sorted by date)
router.get('/', async (req, res) => {
  const db = getDb();
  const result = await db.collection("announcements").find().sort({ date: -1 }).toArray();
  res.send(result);
});

// Create announcement (admin only)
router.post('/', verifyToken, verifyAdmin, async (req, res) => {
  const db = getDb();
  const announcement = req.body;
  announcement.date = new Date();
  const result = await db.collection("announcements").insertOne(announcement);
  res.send(result);
});

// Update announcement (admin only)
router.put('/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const db = getDb();
    const id = req.params.id;
    const updatedData = req.body;
    updatedData.date = new Date();

    const result = await db.collection("announcements").updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({ message: 'Announcement not found' });
    }

    res.send({ message: 'Announcement updated successfully' });
  } catch (error) {
    res.status(500).send({ message: 'Internal server error' });
  }
});

// Delete announcement (admin only)
router.delete('/:id', verifyToken, verifyAdmin, async (req, res) => {
  const db = getDb();
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await db.collection("announcements").deleteOne(query);
  res.send(result);
});

module.exports = router;