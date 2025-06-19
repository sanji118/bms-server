const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: [
    'https://home-haven-8d2d8.web.app',
    'http://localhost:5173',
    'https://home-haven-8d2d8.firebaseapp.com'
  ],
  credentials: true,
}));
app.use(express.json());
app.use((req, res, next) => {
  //console.log(`Incoming request: ${req.method} ${req.path}`);
  next();
});

// Database connection
const { connectToDatabase } = require('./db/connection');
connectToDatabase();

// Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const apartmentRoutes = require('./routes/apartments');
const couponRoutes = require('./routes/coupons');
const announcementRoutes = require('./routes/announcements');
const agreementRoutes = require('./routes/agreements');
const paymentRoutes = require('./routes/payments');
const adminRoutes = require('./routes/admin');

app.use('/jwt', authRoutes);
app.use('/users', userRoutes);
app.use('/apartments', apartmentRoutes);
app.use('/coupons', couponRoutes);
app.use('/announcements', announcementRoutes);
app.use('/agreements', agreementRoutes);
app.use('/payments', paymentRoutes);
app.use('/admin-stats', adminRoutes);

app.get('/', (req, res) => {
  res.send('Building Management Server is running');
});

app.listen(port, () => {
  console.log(`Building Management Server is running on port ${port}`);
});