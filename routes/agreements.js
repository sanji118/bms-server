const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { verifyToken, verifyAdmin } = require('../middleware/auth');
const { getDb } = require('../db/connection');

// Get all agreements (admin only)
router.get('/', verifyToken, verifyAdmin, async (req, res) => {
  const db = getDb();
  const result = await db.collection("agreements").find().toArray();
  res.send(result);
});

// Get agreements for specific user
router.get('/user/:email', verifyToken, async (req, res) => {
  const db = getDb();
  const email = req.params.email;
  
  if (email !== req.decoded.email) {
    return res.status(403).send({ message: 'Forbidden access' });
  }
  
  const result = await db.collection("agreements").find({ userEmail: email }).toArray();
  res.send(result);
});

// Create new agreement
router.post('/', verifyToken, async (req, res) => {
  const db = getDb();
  const agreement = req.body;
  agreement.status = 'pending';
  agreement.date = new Date();
  const result = await db.collection("agreements").insertOne(agreement);
  res.send(result);
});

// Update agreement status (admin only)
router.patch('/:id', verifyToken, verifyAdmin, async (req, res) => {
  const db = getDb();
  const id = req.params.id;
  const filter = { _id: new ObjectId(id) };
  
  const result = await db.collection("agreements").updateOne(
    filter,
    { $set: req.body }
  );
  
  // If accepted, update user role
  if (req.body.status === 'accepted') {
    const agreement = await db.collection("agreements").findOne(filter);
    await db.collection("users").updateOne(
      { email: agreement.userEmail },
      { 
        $set: { 
          role: 'member',
          apartmentId: agreement.apartmentId
        } 
      }
    );
  }
  
  res.send(result);
});

// Delete agreement
router.delete('/:id', verifyToken, async (req, res) => {
  const db = getDb();
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  
  const agreement = await db.collection("agreements").findOne(query);
  
  if (req.decoded.role !== 'admin' && 
      (agreement.userEmail !== req.decoded.email || agreement.status !== 'pending')) {
    return res.status(403).send({ message: 'Forbidden access' });
  }
  
  const result = await db.collection("agreements").deleteOne(query);
  
  if (agreement.status === 'accepted') {
    await db.collection("users").updateOne(
      { email: agreement.userEmail },
      { 
        $set: { 
          role: 'user',
          apartmentId: null
        } 
      }
    );
  }
  
  res.send(result);
});

module.exports = router;