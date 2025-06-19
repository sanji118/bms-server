const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { verifyToken, verifyAdmin } = require('../middleware/auth');
const { getDb } = require('../db/connection');

// Create coupon (admin only)
router.post('/', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const db = getDb();
    const coupon = req.body;
    coupon.createdAt = new Date();
    coupon.status = 'active';
    
    if (!coupon.code || !coupon.discount || !coupon.expiryDate) {
      return res.status(400).send({ error: 'Missing required coupon fields' });
    }

    const existingCoupon = await db.collection("coupons").findOne({ code: coupon.code });
    if (existingCoupon) {
      return res.status(400).send({ error: 'Coupon code already exists' });
    }

    const result = await db.collection("coupons").insertOne(coupon);
    res.status(201).send(result);
  } catch (error) {
    res.status(500).send({ error: 'Internal Server Error' });
  }
});

// Get all coupons
router.get('/', verifyToken, async (req, res) => {
  try {
    const db = getDb();
    const coupons = await db.collection("coupons").find().toArray();
    res.send(coupons);
  } catch (error) {
    res.status(500).send({ error: 'Internal Server Error' });
  }
});

// Apply coupon
router.post('/apply', verifyToken, async (req, res) => {
  try {
    const db = getDb();
    const { code } = req.body;
    const email = req.decoded.email;

    if (!code) {
      return res.status(400).send({ error: 'Coupon code is required' });
    }

    const coupon = await db.collection("coupons").findOne({ code });
    if (!coupon) {
      return res.status(404).send({ error: 'Coupon not found' });
    }

    const now = new Date();
    if (coupon.status !== 'active') {
      return res.status(400).send({ error: 'Coupon is not active' });
    }

    if (coupon.expiryDate && new Date(coupon.expiryDate) < now) {
      await db.collection("coupons").updateOne(
        { _id: coupon._id },
        { $set: { status: 'expired' } }
      );
      return res.status(400).send({ error: 'Coupon has expired' });
    }

    const existingPayment = await db.collection("payments").findOne({
      userEmail: email,
      couponCode: code
    });

    if (existingPayment && !coupon.reusable) {
      return res.status(400).send({ error: 'Coupon has already been used' });
    }

    res.send({
      valid: true,
      discount: coupon.discount,
      type: coupon.type,
      couponId: coupon._id,
      message: 'Coupon applied successfully'
    });
  } catch (error) {
    res.status(500).send({ error: 'Internal Server Error' });
  }
});

// Delete coupon (admin only)
router.delete('/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const db = getDb();
    const id = req.params.id;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ error: 'Invalid coupon ID' });
    }

    const result = await db.collection("coupons").deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      return res.status(404).send({ error: 'Coupon not found' });
    }

    res.send({ message: 'Coupon deleted successfully' });
  } catch (error) {
    res.status(500).send({ error: 'Internal Server Error' });
  }
});

module.exports = router;