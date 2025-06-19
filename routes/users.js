const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { verifyToken, verifyAdmin } = require('../middleware/auth');
const { getDb } = require('../db/connection');

// Get all users (admin only)
router.get('/', verifyToken, verifyAdmin, async (req, res) => {
  const db = getDb();
  const result = await db.collection("users").find().toArray();
  res.send(result);
});

// Get single user by email
router.get('/:email', async (req, res) => {
  try {
    const db = getDb();
    const user = await db.collection("users").findOne({ email: req.params.email });
    if (!user) return res.status(404).send('User not found');
    res.json(user);
  } catch (error) {
    res.status(500).send('Server error');
  }
});

// Create new user
router.post('/', async (req, res) => {
  const db = getDb();
  const user = req.body;
  const query = { email: user.email };
  const existingUser = await db.collection("users").findOne(query);
  
  if (existingUser) {
    return res.send({ message: 'User already exists', insertedId: null });
  }
  
  const result = await db.collection("users").insertOne(user);
  res.send(result);
});

// Update user to admin (admin only)
router.patch('/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const db = getDb();
    const id = req.params.id;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: 'Invalid user ID' });
    }

    const currentUser = await db.collection("users").findOne({ email: req.decoded.email });
    if (currentUser._id.equals(new ObjectId(id))) {
      return res.status(403).send({ message: 'You cannot modify your own role' });
    }

    const result = await db.collection("users").updateOne(
      { _id: new ObjectId(id) },
      { $set: { role: 'admin' } }
    );
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: 'Internal server error' });
  }
});

// Delete user (admin only)
router.delete('/:id', verifyToken, verifyAdmin, async (req, res) => {
  const db = getDb();
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await db.collection("users").deleteOne(query);
  res.send(result);
});

// Check if user is admin
router.get('/admin/:email', verifyToken, async (req, res) => {
  const db = getDb();
  const email = req.params.email;
  
  if (email !== req.decoded.email) {
    return res.status(403).send({ message: 'Forbidden access' });
  }
  
  const user = await db.collection("users").findOne({ email });
  res.send({ admin: user?.role === 'admin' });
});

// Check if user is member
router.get('/member/:email', verifyToken, async (req, res) => {
  const db = getDb();
  const email = req.params.email;
  
  if (email !== req.decoded.email) {
    return res.status(403).send({ message: 'Forbidden access' });
  }
  
  const user = await db.collection("users").findOne({ email });
  res.send({ member: user?.role === 'member' });
});

module.exports = router;