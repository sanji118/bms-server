const jwt = require('jsonwebtoken');
const { getDb } = require('../db/connection');

const verifyToken = async (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).send({ message: 'Unauthorized access' });
  }
  const token = req.headers.authorization.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    req.decoded = decoded;
    next();
  } catch (err) {
    return res.status(401).send({ message: 'Unauthorized access' });
  }
};

const verifyAdmin = async (req, res, next) => {
  const db = getDb();
  const userCollection = db.collection("users");
  
  try {
    const email = req.decoded.email;
    const query = { email: email };
    const user = await userCollection.findOne(query);
    const isAdmin = user?.role === 'admin';
    
    if (!isAdmin) {
      return res.status(403).send({ message: 'Forbidden access' });
    }
    next();
  } catch (error) {
    return res.status(500).send({ message: 'Internal server error' });
  }
};

module.exports = {
  verifyToken,
  verifyAdmin
};