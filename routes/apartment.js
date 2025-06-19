const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { verifyToken, verifyAdmin } = require('../middleware/auth');
const { getDb } = require('../db/connection');

// Get all apartments
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const result = await db.collection("apartments").find().toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: 'Failed to fetch apartments' });
  }
});

// Get single apartment
router.get('/:id', async (req, res) => {
  const db = getDb();
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await db.collection("apartments").findOne(query);
  res.send(result);
});

// Create apartment (admin only)
router.post('/', verifyToken, verifyAdmin, async (req, res) => {
  const db = getDb();
  const apartment = req.body;
  const result = await db.collection("apartments").insertOne(apartment);
  res.send(result);
});

// Update apartment (admin only)
router.patch('/:id', verifyToken, verifyAdmin, async (req, res) => {
  const db = getDb();
  const id = req.params.id;
  const filter = { _id: new ObjectId(id) };
  const result = await db.collection("apartments").updateOne(filter, { $set: req.body });
  res.send(result);
});

// Delete apartment (admin only)
router.delete('/:id', verifyToken, verifyAdmin, async (req, res) => {
  const db = getDb();
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await db.collection("apartments").deleteOne(query);
  res.send(result);
});

module.exports = router;