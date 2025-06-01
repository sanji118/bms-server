

const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;

// middleware
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
  console.log(`Incoming request: ${req.method} ${req.path}`);
  next();
});


app.get('/env-check', (req, res) => {
  res.json({
    DB_USER: process.env.DB_USER || process.env.db_user || 'NOT_FOUND',
    DB_PASS: process.env.DB_PASS || process.env.db_pass || 'NOT_FOUND',
    ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET || 'NOT_FOUND',
    NODE_ENV: process.env.NODE_ENV || 'development'
  });
});

const couponsFromJson = require('./coupons.json')
const apartments = require('./apartments.json')


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.95qfhdq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  
});



async function run() {
  try {
    // Connect the client to the server
     //client.connect();

    // Collections
    const userCollection = client.db("buildingDB").collection("users");
    const apartmentCollection = client.db("buildingDB").collection("apartments");
    const couponCollection = client.db("buildingDB").collection("coupons");
    const announcementCollection = client.db("buildingDB").collection("announcements");
    const agreementCollection = client.db("buildingDB").collection("agreements");
    const paymentCollection = client.db("buildingDB").collection("payments");

        
    const couponCount = await couponCollection.estimatedDocumentCount();
    if (couponCount === 0) {
    await couponCollection.insertMany(couponsFromJson);
    console.log('Coupons seeded');
    }

    const apartmentCount = await apartmentCollection.estimatedDocumentCount();
    if (apartmentCount === 0) {
    await apartmentCollection.insertMany(apartments);
    console.log('Apartments seeded');
    }


    app.get('/connection-test', async (req, res) => {
  let client;
  try {
    // Create a new connection instead of using the global client
    client = new MongoClient(uri, {
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 20000
    });
    
    console.log('Attempting connection...');
    await client.connect();
    
    console.log('Pinging database...');
    const ping = await client.db("admin").command({ ping: 1 });
    
    res.json({
      success: true,
      ping,
      connection: "Successful",
      stats: {
        host: client.topology.s.servers.keys().next().value,
        connectionTime: new Date()
      }
    });
    
  } catch (err) {
    console.error('Connection error:', err);
    res.status(500).json({
      success: false,
      error: err.message,
      advice: "Check MongoDB Atlas network access",
      time: new Date()
    });
  } finally {
    if (client) await client.close();
  }
});
    // JWT related API
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ token });
    });

    // Middlewares
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'Unauthorized access' });
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'Unauthorized access' });
        }
        req.decoded = decoded;
        next();
      });
    };

    // Verify admin after verifyToken
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'Forbidden access' });
      }
      next();
    };


    // Users related API
    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });
    app.get('/users/:email', async (req, res) => {
      try {
        const user = await userCollection.findOne({ email: req.params.email });
        if (!user) return res.status(404).send('User not found');
        res.json(user);
      } catch (error) {
        res.status(500).send('Server error');
      }
    });

    app.patch('/users/user/:id', verifyToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: 'Invalid user ID' });
        }

        const filter = { _id: new ObjectId(id) };
        
        // Check if the current user is trying to modify themselves
        const currentUser = await userCollection.findOne({ email: req.decoded.email });
        if (currentUser._id.equals(new ObjectId(id))) {
          return res.status(403).send({ message: 'You cannot modify your own role' });
        }

        const updatedDoc = {
          $set: {
            role: 'user'
          }
        };
        const result = await userCollection.updateOne(filter, updatedDoc);
        res.send(result);
      } catch (error) {
        console.error('Error updating role:', error);
        res.status(500).send({ message: 'Internal server error' });
      }
    });

    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'Forbidden access' });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'admin';
      }
      res.send({ admin });
    });

    app.get('/users/member/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'Forbidden access' });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let member = false;
      if (user) {
        member = user?.role === 'member';
      }
      res.send({ member });
    });

    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'User already exists', insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      if(!ObjectId.isValid(id)){
        return res.status(400).send({message: 'Invalid user ID'});
      }
      const filter = { _id: new ObjectId(id) };
      const currentUser = await userCollection.findOne({email: req.decoded.email});
      if(currentUser._id.equals(new ObjectId(id))){
        return res.status(403).send({message: 'You cannot modify your own role'});
      }
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.patch('/users/member/:id', verifyToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: 'Invalid user ID' });
        }

        const filter = { _id: new ObjectId(id) };
        
        // Check if the current user is trying to modify themselves
        const currentUser = await userCollection.findOne({ email: req.decoded.email });
        if (currentUser._id.equals(new ObjectId(id))) {
          return res.status(403).send({ message: 'You cannot modify your own role' });
        }

        const updatedDoc = {
          $set: {
            role: 'member'
          }
        };
        const result = await userCollection.updateOne(filter, updatedDoc);
        res.send(result);
      } catch (error) {
        console.error('Error updating role:', error);
        res.status(500).send({ message: 'Internal server error' });
      }
    });

    app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    // Apartments related API
    app.get('/apartments', async (req, res) => {
      try {
        const result = await apartmentCollection.find().toArray();
        console.log('Found apartments:', result.length);
        res.send(result);
      } catch (error) {
        console.error('Error fetching apartments:', error);
        res.status(500).send({ error: 'Failed to fetch apartments' });
      }
    });

    app.get('/apartments/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await apartmentCollection.findOne(query);
      res.send(result);
    });

    app.post('/apartments', verifyToken, verifyAdmin, async (req, res) => {
      const apartment = req.body;
      const result = await apartmentCollection.insertOne(apartment);
      res.send(result);
    });

    app.patch('/apartments/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: req.body
      };
      const result = await apartmentCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.delete('/apartments/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await apartmentCollection.deleteOne(query);
      res.send(result);
    });



    //Coupon related API
    app.post('/coupons', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const coupon = req.body;
        coupon.createdAt = new Date();
        coupon.status = 'active'; // default status
        
        // Validate coupon data
        if (!coupon.code || !coupon.discount || !coupon.expiryDate) {
        return res.status(400).send({ error: 'Missing required coupon fields' });
        }

        // Check if coupon code already exists
        const existingCoupon = await couponCollection.findOne({ code: coupon.code });
        if (existingCoupon) {
        return res.status(400).send({ error: 'Coupon code already exists' });
        }

        const result = await couponCollection.insertOne(coupon);
        res.status(201).send(result);
    } catch (error) {
        console.error('Error creating coupon:', error);
        res.status(500).send({ error: 'Internal Server Error' });
    }
    });

    app.get('/coupons', verifyToken, async (req, res) => {
    try {
        const coupons = await couponCollection.find().toArray();
        res.send(coupons);
    } catch (error) {
        console.error('Error fetching coupons:', error);
        res.status(500).send({ error: 'Internal Server Error' });
    }
    });

    app.get('/coupons/:id', verifyToken, async (req, res) => {
    try {
        const id = req.params.id;
        if (!ObjectId.isValid(id)) {
        return res.status(400).send({ error: 'Invalid coupon ID' });
        }
        
        const coupon = await couponCollection.findOne({ _id: new ObjectId(id) });
        if (!coupon) {
        return res.status(404).send({ error: 'Coupon not found' });
        }
        res.send(coupon);
    } catch (error) {
        console.error('Error fetching coupon:', error);
        res.status(500).send({ error: 'Internal Server Error' });
    }
    });

    app.patch('/coupons/:id', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const id = req.params.id;
        const updates = req.body;
        
        if (!ObjectId.isValid(id)) {
        return res.status(400).send({ error: 'Invalid coupon ID' });
        }

        // Validate updates
        const allowedUpdates = ['code', 'discount', 'expiryDate', 'description', 'minAmount'];
        const isValidUpdate = Object.keys(updates).every(update => 
        allowedUpdates.includes(update)
        );
        
        if (!isValidUpdate) {
        return res.status(400).send({ error: 'Invalid updates' });
        }

        const result = await couponCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updates }
        );

        if (result.matchedCount === 0) {
        return res.status(404).send({ error: 'Coupon not found' });
        }

        res.send({ message: 'Coupon updated successfully' });
    } catch (error) {
        console.error('Error updating coupon:', error);
        res.status(500).send({ error: 'Internal Server Error' });
    }
    });

    app.patch('/coupons/:id/status', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const id = req.params.id;
        const { status } = req.body;
        
        if (!ObjectId.isValid(id)) {
        return res.status(400).send({ error: 'Invalid coupon ID' });
        }

        if (!['active', 'inactive', 'expired'].includes(status)) {
        return res.status(400).send({ error: 'Invalid status value' });
        }

        const result = await couponCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status } }
        );

        if (result.matchedCount === 0) {
        return res.status(404).send({ error: 'Coupon not found' });
        }

        res.send({ message: 'Coupon status updated successfully' });
    } catch (error) {
        console.error('Error updating coupon status:', error);
        res.status(500).send({ error: 'Internal Server Error' });
    }
    });

    app.delete('/coupons/:id', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const id = req.params.id;
        if (!ObjectId.isValid(id)) {
        return res.status(400).send({ error: 'Invalid coupon ID' });
        }

        const result = await couponCollection.deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) {
        return res.status(404).send({ error: 'Coupon not found' });
        }

        res.send({ message: 'Coupon deleted successfully' });
    } catch (error) {
        console.error('Error deleting coupon:', error);
        res.status(500).send({ error: 'Internal Server Error' });
    }
    });

    app.post('/coupons/apply', verifyToken, async (req, res) => {
    try {
        const { code } = req.body;
        const email = req.decoded.email;

        if (!code) {
        return res.status(400).send({ error: 'Coupon code is required' });
        }

        // Find the coupon
        const coupon = await couponCollection.findOne({ code });
        if (!coupon) {
        return res.status(404).send({ error: 'Coupon not found' });
        }

        // Check coupon validity
        const now = new Date();
        if (coupon.status !== 'active') {
        return res.status(400).send({ error: 'Coupon is not active' });
        }

        if (coupon.expiryDate && new Date(coupon.expiryDate) < now) {
        // Update coupon status to expired
        await couponCollection.updateOne(
            { _id: coupon._id },
            { $set: { status: 'expired' } }
        );
        return res.status(400).send({ error: 'Coupon has expired' });
        }

        // Check if user has already used this coupon
        const existingPayment = await paymentCollection.findOne({
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
        console.error('Error applying coupon:', error);
        res.status(500).send({ error: 'Internal Server Error' });
    }
    });

    // Announcements related API
    app.get('/announcements', async (req, res) => {
      const result = await announcementCollection.find().sort({ date: -1 }).toArray();
      res.send(result);
    });

    app.post('/announcements', verifyToken, verifyAdmin, async (req, res) => {
      const announcement = req.body;
      announcement.date = new Date();
      const result = await announcementCollection.insertOne(announcement);
      res.send(result);
    });
    app.put('/announcements/:id', verifyToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const updatedData = req.body;

        // Optionally update the date field to now
        updatedData.date = new Date();

        const filter = { _id: new ObjectId(id) };
        const updateDoc = { $set: updatedData };

        const result = await announcementCollection.updateOne(filter, updateDoc);

        if (result.matchedCount === 0) {
          return res.status(404).send({ message: 'Announcement not found' });
        }

        res.send({ message: 'Announcement updated successfully' });
      } catch (error) {
        console.error('Error updating announcement:', error);
        res.status(500).send({ message: 'Internal server error' });
      }
    });

    app.delete('/announcements/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await announcementCollection.deleteOne(query);
      res.send(result);
    });

    // Agreements related API
    app.get('/agreements', verifyToken, verifyAdmin, async (req, res) => {
      const result = await agreementCollection.find().toArray();
      res.send(result);
    });

    app.get('/agreements/user/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'Forbidden access' });
      }
      const query = { userEmail: email };
      const result = await agreementCollection.find(query).toArray();
      res.send(result);
    });

    app.post('/agreements', verifyToken, async (req, res) => {
      const agreement = req.body;
      agreement.status = 'pending';
      agreement.date = new Date();
      const result = await agreementCollection.insertOne(agreement);
      res.send(result);
    });

    app.patch('/agreements/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: req.body
      };
      const result = await agreementCollection.updateOne(filter, updatedDoc);
      
      // If agreement is accepted, update user role to member
      if (req.body.status === 'accepted') {
        const agreement = await agreementCollection.findOne(filter);
        const userFilter = { email: agreement.userEmail };
        const userUpdate = {
          $set: {
            role: 'member',
            apartmentId: agreement.apartmentId
          }
        };
        await userCollection.updateOne(userFilter, userUpdate);
      }
      
      res.send(result);
    });

    // Add this to your backend routes (server-side)
    app.delete('/agreements/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      
      // First get the agreement to check permissions
      const agreement = await agreementCollection.findOne(query);
      
      // Only allow deletion if:
      // 1. User is admin OR
      // 2. User owns the agreement AND it's still pending
      if (req.decoded.role !== 'admin' && 
          (agreement.userEmail !== req.decoded.email || agreement.status !== 'pending')) {
        return res.status(403).send({ message: 'Forbidden access' });
      }
      
      const result = await agreementCollection.deleteOne(query);
      
      // If the agreement was accepted, revert user role if needed
      if (agreement.status === 'accepted') {
        const userFilter = { email: agreement.userEmail };
        const userUpdate = {
          $set: {
            role: 'user',
            apartmentId: null
          }
        };
        await userCollection.updateOne(userFilter, userUpdate);
      }
      
      res.send(result);
    });

    // Payments related API
    app.get('/payments', verifyToken, verifyAdmin, async (req, res) => {
      const result = await paymentCollection.find().toArray();
      res.send(result);
    });

    app.get('/payments/user/:email', verifyToken, async (req, res) => {
      try {
        const email = req.params.email;
        const month = req.query.month;
        
        const query = { memberEmail: email };
        if (month) {
          query.month = month;
        }
        
        const result = await paymentCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error('Error fetching user payments:', error);
        res.status(500).send({ message: 'Internal server error' });
      }
    });
    app.post('/payments/request', verifyToken, async (req, res) => {
      try {
        const payment = req.body;
        payment.date = new Date();
        payment.status = 'pending'; // Manual payments start as pending
        
        // Validate required fields
        if (!payment.memberEmail || !payment.amount || !payment.month || !payment.agreementId) {
          return res.status(400).json({ error: 'Missing required fields' });
        }

        // Check for duplicate pending payments for same month
        const existingPayment = await paymentCollection.findOne({
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

        const result = await paymentCollection.insertOne(payment);
        res.status(201).json(result.ops[0]);
      } catch (err) {
        console.error('Error saving payment request:', err);
        res.status(500).json({ error: err.message });
      }
    });

    app.post('/payments', verifyToken, async (req, res) => {
      try {
        const payment = req.body;
        payment.date = new Date();
        payment.status = 'completed';
        
        // Validate required fields
        if (!payment.memberEmail || !payment.amount || !payment.month) {
          return res.status(400).json({ error: 'Missing required fields' });
        }

        // Check for duplicate payments
        const existingPayment = await paymentCollection.findOne({
          memberEmail: payment.memberEmail,
          month: payment.month,
          status: 'completed'
        });

        if (existingPayment) {
          return res.status(400).json({ error: 'Payment for this month already exists' });
        }

        const result = await paymentCollection.insertOne(payment);
        
        // Update agreement with last payment
        if (payment.agreementId) {
          await agreementCollection.updateOne(
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
        console.error('Error saving payment:', err);
        res.status(500).json({ error: err.message });
      }
    });


    // Admin stats
    app.get('/admin-stats', verifyToken, verifyAdmin, async (req, res) => {
      const users = await userCollection.estimatedDocumentCount();
      const members = await userCollection.countDocuments({ role: 'member' });
      const apartments = await apartmentCollection.estimatedDocumentCount();
      const availableApartments = await apartmentCollection.countDocuments({ status: 'available' });
      const payments = await paymentCollection.estimatedDocumentCount();
      
      const revenueResult = await paymentCollection.aggregate([
        {
          $group: {
            _id: null,
            totalRevenue: {
              $sum: '$amount'
            }
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

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Building Management Server is running');
});

app.listen(port, () => {
  console.log(`Building Management Server is running on port ${port}`);
});
