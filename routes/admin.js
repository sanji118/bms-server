const express = require('express');
const router = express.Router();
const { verifyToken, verifyAdmin } = require('../middleware/auth');
const { getDb } = require('../db/connection');

router.get('/', verifyToken, verifyAdmin, async (req, res) => {
  const db = getDb();
  
  const users = await db.collection("users").estimatedDocumentCount();
  const members = await db.collection("users").countDocuments({ role: 'member' });
  const apartments = await db.collection("apartments").estimatedDocumentCount();
  const availableApartments = await db.collection("apartments").countDocuments({ status: 'available' });
  const payments = await db.collection("payments").estimatedDocumentCount();
  
  const revenueResult = await db.collection("payments").aggregate([
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$amount' }
      }
    }
  ]).toArray();

  const revenue = revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;

  res.send({
    users,
    members,
    apartments,
    availableApartments,
    payments,
    revenue
  });
});

module.exports = router;