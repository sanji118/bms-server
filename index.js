const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: ['http://localhost:5173'],
    credentials: true
}));
app.use(express.json());

// Sample data imports
const apartments = require('./apartments.json');
const coupons = require('./coupons.json');

// MongoDB Connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.95qfhdq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// JWT Verification Middleware
const verifyJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).send({ error: 'Unauthorized - No token provided' });

    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) return res.status(403).send({ error: 'Forbidden - Invalid token' });
        req.user = decoded;
        next();
    });
};

// Role Verification Middleware
const verifyRole = (requiredRole) => {
    return (req, res, next) => {
        if (req.user.role !== requiredRole) {
            return res.status(403).send({ error: 'Access denied - Insufficient permissions' });
        }
        next();
    };
};

// Database Connection and Routes
async function run() {
    try {
        await client.connect();
        console.log("Successfully connected to MongoDB!");

        const db = client.db('apartmentsDB');
        const apartmentCollection = db.collection('apartments');
        const couponCollection = db.collection('coupons');
        const userCollection = db.collection('users');
        const announcementCollection = db.collection('announcements');
        const agreementCollection = db.collection('agreements');
        const paymentCollection = db.collection('payments');

        // Initialize sample data if collections are empty
        const apartmentCount = await apartmentCollection.countDocuments();
        if (apartmentCount === 0) {
            await apartmentCollection.insertMany(apartments);
        }

        const couponCount = await couponCollection.countDocuments();
        if (couponCount === 0) {
            await couponCollection.insertMany(coupons);
        }

        // ==================== Authentication Routes ====================
        app.post('/jwt', async (req, res) => {
            try {
                const user = req.body;
                if (!user.email) {
                    return res.status(400).send({ error: 'Email is required' });
                }

                const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
                res.send({ token });
            } catch (error) {
                console.error('Error generating JWT:', error);
                res.status(500).send({ error: 'Internal server error' });
            }
        });

        // ==================== User Routes ====================
        app.post('/users', async (req, res) => {
            try {
                const { name, email, photo, role } = req.body;
                
                // Basic validation
                if (!email || !email.includes('@')) {
                    return res.status(400).send({ error: 'Valid email is required' });
                }
                if (role && !['user', 'member', 'admin'].includes(role)) {
                    return res.status(400).send({ error: 'Invalid role specified' });
                }

                const filter = { email };
                const updateDoc = {
                    $set: {
                        name,
                        photo,
                        role: role || 'user',
                        createdAt: new Date()
                    }
                };
                const options = { upsert: true, returnDocument: 'after' };

                const result = await userCollection.findOneAndUpdate(filter, updateDoc, options);
                res.status(200).send(result.value);
            } catch (error) {
                console.error('Error saving user:', error);
                res.status(500).send({ error: 'Failed to save user' });
            }
        });

        app.get('/users/:email', async (req, res) => {
            try {
                const email = req.params.email;
                const user = await userCollection.findOne({ email });
                if (!user) {
                    return res.status(404).send({ error: 'User not found' });
                }
                res.send(user);
            } catch (error) {
                console.error('Error fetching user:', error);
                res.status(500).send({ error: 'Internal Server Error' });
            }
        });

        // ==================== Apartment Routes ====================
        app.get('/apartments', async (req, res) => {
            try {
                const apartments = await apartmentCollection.find().toArray();
                res.send(apartments);
            } catch (error) {
                console.error('Error fetching apartments:', error);
                res.status(500).send({ error: 'Internal Server Error' });
            }
        });

        app.get('/apartments/:id', async (req, res) => {
            try {
                const id = req.params.id;
                if (!ObjectId.isValid(id)) {
                    return res.status(400).send({ error: 'Invalid apartment ID' });
                }
                
                const apartment = await apartmentCollection.findOne({ _id: new ObjectId(id) });
                if (!apartment) {
                    return res.status(404).send({ error: 'Apartment not found' });
                }
                res.send(apartment);
            } catch (error) {
                console.error('Error fetching apartment:', error);
                res.status(500).send({ error: 'Internal Server Error' });
            }
        });

        // ==================== Coupon Routes ====================
        app.get('/coupons', async (req, res) => {
            try {
                const coupons = await couponCollection.find().toArray();
                res.send(coupons);
            } catch (error) {
                console.error('Error fetching coupons:', error);
                res.status(500).send({ error: 'Internal Server Error' });
            }
        });

        app.get('/coupons/:code', async (req, res) => {
            try {
                const code = req.params.code;
                const coupon = await couponCollection.findOne({ code });
                if (!coupon) {
                    return res.status(404).send({ error: 'Coupon not found' });
                }
                res.send(coupon);
            } catch (error) {
                console.error('Error fetching coupon:', error);
                res.status(500).send({ error: 'Internal Server Error' });
            }
        });

        // ==================== Announcement Routes ====================
        app.get('/announcements', async (req, res) => {
            try {
                const announcements = await announcementCollection.find()
                    .sort({ createdAt: -1 })
                    .toArray();
                res.send(announcements);
            } catch (error) {
                console.error('Error fetching announcements:', error);
                res.status(500).send({ error: 'Internal Server Error' });
            }
        });

        // ==================== Basic Admin Routes ====================
        app.get('/admin/users', verifyJWT, verifyRole('admin'), async (req, res) => {
            try {
                const users = await userCollection.find().toArray();
                res.send(users);
            } catch (error) {
                console.error('Error fetching users:', error);
                res.status(500).send({ error: 'Internal Server Error' });
            }
        });

        // Root route
        app.get('/', (req, res) => {
            res.send('Building Management System server is running');
        });

    } catch (error) {
        console.error('Server startup error:', error);
    }
}

run().catch(console.dir);

// Start server
app.listen(port, () => {
    console.log(`Building Management Server is running on port: ${port}`);
});