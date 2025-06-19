const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { verifyToken, verifyAdmin } = require('../middleware/auth');
const { getDb } = require('../db/connection');

// Get all payments (admin only)
router.get('/', verifyToken, verifyAdmin, async (req, res) => {
  const db = getDb();
  const result = await db.collection("payments").find().toArray();
  res.send(result);
});

// Get payments for specific user
router.get('/user/:email', verifyToken, async (req, res) => {
  try {
    const db = getDb();
    const email = req.params.email;
    const month = req.query.month;
    
    const query = { memberEmail: email };
    if (month) {
      query.month = month;
    }
    
    const result = await db.collection("payments").find(query).toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: 'Internal server error' });
  }
});

// Create payment request
router.post('/request', verifyToken, async (req, res) => {
  try {
    const db = getDb();
    const payment = req.body;
    payment.date = new Date();
    payment.status = 'pending';
    
    if (!payment.memberEmail || !payment.amount || !payment.month || !payment.agreementId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const existingPayment = await db.collection("payments").findOne({
      memberEmail: payment.memberEmail,
      month: payment.month,
      status: { $in: ['pending', 'completed'] }
    });

    if (existingPayment) {
      return res.status(400).json({ 
        error: existingPayment.status === 'pending' 
          ? 'Pending payment already exists for this month' 
          : 'Payment for this month already completed'
      });
    }

    const result = await db.collection("payments").insertOne(payment);
    res.status(201).json(result.ops[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create completed payment
router.post('/', verifyToken, async (req, res) => {
  try {
    const db = getDb();
    const payment = req.body;
    payment.date = new Date();
    payment.status = 'completed';
    
    if (!payment.memberEmail || !payment.amount || !payment.month) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const existingPayment = await db.collection("payments").findOne({
      memberEmail: payment.memberEmail,
      month: payment.month,
      status: 'completed'
    });

    if (existingPayment) {
      return res.status(400).json({ error: 'Payment for this month already exists' });
    }

    const result = await db.collection("payments").insertOne(payment);
    
    if (payment.agreementId) {
      await db.collection("agreements").updateOne(
        { _id: new ObjectId(payment.agreementId) },
        { 
          $set: { 
            lastPaymentDate: new Date(),
            lastPaymentMonth: payment.month
          } 
        }
      );
    }

    res.status(201).json(result.ops[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;