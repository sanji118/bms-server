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
  if (!authHeader) return res.status(401).send('Unauthorized');
  
  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) return res.status(403).send('Forbidden');
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

        // ==================== Authentication Routes ====================
        app.post('/jwt', async (req, res) => {
            try {
                const user = await userCollection.findOne({ email: req.body.email });
                if (!user) {
                    return res.status(404).send({ error: 'User not found' });
                }
                
                const userData = {
                    email: user.email,
                    role: user.role
                }
                
                const accessToken = jwt.sign(
                    userData,
                    process.env.ACCESS_TOKEN_SECRET,
                    {expiresIn: '1d'}
                )
                
                res.json({token: accessToken, role: userData.role})
            } catch (error) {
                console.error('Error generating JWT:', error);
                res.status(400).json({ error: 'Failed to generate token' });
            }
        });

        // ==================== User Routes ====================
        app.post('/users', async (req, res) => {
            try {
                const { name, email, photo, role } = req.body;
                
                if (!email || !email.includes('@')) {
                    return res.status(400).send({ error: 'Valid email is required' });
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
                const options = { upsert: true };

                const result = await userCollection.updateOne(filter, updateDoc, options);
                res.status(200).send(result);
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

        app.get('/coupons/:id', async (req, res) => {
            try {
                const id = req.params.id;
                if (!ObjectId.isValid(id)) {
                    return res.status(400).send({ error: 'Invalid apartment ID' });
                }
                
                const coupon = await couponCollection.findOne({ _id: new ObjectId(id) });
                if (!coupon) {
                    return res.status(404).send({ error: 'Coupon not found' });
                }
                res.send(coupon);
            } catch (error) {
                console.error('Error fetching Coupon:', error);
                res.status(500).send({ error: 'Internal Server Error' });
            }
        });

        app.post('/coupons', verifyJWT, verifyRole('admin'), async (req, res) => {
            try {
                const coupon = req.body;
                const result = await couponCollection.insertOne(coupon);
                res.status(201).send(result);
            } catch (error) {
                console.error('Error creating coupon:', error);
                res.status(500).send({ error: 'Internal Server Error' });
            }
        });

        app.patch('/coupons/:id', verifyJWT, verifyRole('admin'), async (req, res) => {
            try {
                const id = req.params.id;
                const { status } = req.body;
                
                if (!ObjectId.isValid(id)) {
                    return res.status(400).send({ error: 'Invalid coupon ID' });
                }

                const result = await couponCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { status } }
                );

                if (result.modifiedCount === 0) {
                    return res.status(404).send({ error: 'Coupon not found' });
                }

                res.send({ 
                message: 'Coupon status updated successfully',
                updatedCoupon: await couponCollection.findOne({ _id: new ObjectId(id) })
            });
            } catch (error) {
                console.error('Error updating coupon:', error);
                res.status(500).send({ error: 'Internal Server Error' });
            }
        });


        app.delete('/coupons/:id', verifyJWT, verifyRole('admin'), async (req, res) => {
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

        app.post('/announcements', verifyJWT, verifyRole('admin'), async (req, res) => {
            try {
                const announcement = req.body;
                announcement.createdAt = new Date();
                const result = await announcementCollection.insertOne(announcement);
                res.status(201).send(result);
            } catch (error) {
                console.error('Error creating announcement:', error);
                res.status(500).send({ error: 'Internal Server Error' });
            }
        });
        
        app.put('/announcements/:id', verifyJWT, verifyRole('admin'), async (req, res) => {
            try {
                const { id } = req.params;
                const updateData = req.body;
                
                // You might want to add validation here
                
                const result = await announcementCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: updateData }
                );
                
                if (result.matchedCount === 0) {
                    return res.status(404).send({ error: 'Announcement not found' });
                }
                
                res.send({ success: true, message: 'Announcement updated' });
            } catch (error) {
                console.error('Error updating announcement:', error);
                res.status(500).send({ error: 'Internal Server Error' });
            }
        });

        
        app.delete('/announcements/:id', verifyJWT, verifyRole('admin'), async (req, res) => {
            try {
                const { id } = req.params;
                
                const result = await announcementCollection.deleteOne(
                    { _id: new ObjectId(id) }
                );
                
                if (result.deletedCount === 0) {
                    return res.status(404).send({ error: 'Announcement not found' });
                }
                
                res.send({ success: true, message: 'Announcement deleted' });
            } catch (error) {
                console.error('Error deleting announcement:', error);
                res.status(500).send({ error: 'Internal Server Error' });
            }
        });

        // ==================== Agreement Routes ====================
        app.get('/agreements', verifyJWT, async (req, res) => {
            try {
                const userEmail = req.user.email;
                const agreements = await agreementCollection.find({ userEmail }).toArray();
                res.send(agreements);
            } catch (error) {
                console.error('Error fetching agreements:', error);
                res.status(500).send({ error: 'Internal Server Error' });
            }
        });

        app.get('/agreements/requests', verifyJWT, verifyRole('admin'), async (req, res) => {
            try {
                const requests = await agreementCollection.find({ status: 'pending' }).toArray();
                res.send(requests);
            } catch (error) {
                console.error('Error fetching agreement requests:', error);
                res.status(500).send({ error: 'Internal Server Error' });
            }
        });

        app.post('/agreements', verifyJWT, async (req, res) => {
            try {
                const agreement = req.body;
                agreement.status = 'pending';
                agreement.createdAt = new Date();
                const result = await agreementCollection.insertOne(agreement);
                res.status(201).send(result);
            } catch (error) {
                console.error('Error creating agreement:', error);
                res.status(500).send({ error: 'Internal Server Error' });
            }
        });

        app.patch('/agreements/:id', verifyJWT, verifyRole('admin'), async (req, res) => {
            try {
                const id = req.params.id;
                const { status } = req.body;
                
                if (!ObjectId.isValid(id)) {
                    return res.status(400).send({ error: 'Invalid agreement ID' });
                }

                const agreement = await agreementCollection.findOne({ _id: new ObjectId(id) });
                if (!agreement) {
                    return res.status(404).send({ error: 'Agreement not found' });
                }

                
                const result = await agreementCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { status } }
                );

                
                if (status === 'accepted') {
                    await userCollection.updateOne(
                        { email: agreement.userEmail },
                        { $set: { role: 'member' } }
                    );
                }

                res.send({ message: 'Agreement updated successfully' });
            } catch (error) {
                console.error('Error updating agreement:', error);
                res.status(500).send({ error: 'Internal Server Error' });
            }
        });

        // ==================== Payment Routes ====================
        app.get('/payments', verifyJWT, async (req, res) => {
            try {
                const memberEmail = req.user.email;
                const payments = await paymentCollection.find({ memberEmail }).toArray();
                res.send(payments);
            } catch (error) {
                console.error('Error fetching payments:', error);
                res.status(500).send({ error: 'Internal Server Error' });
            }
        });


        app.post('/payments', verifyJWT, async (req, res) => {
            try {
                const payment = req.body;
                payment.createdAt = new Date();
                payment.status = 'completed';
                const result = await paymentCollection.insertOne(payment);
                res.status(201).send(result);
            } catch (error) {
                console.error('Error creating payment:', error);
                res.status(500).send({ error: 'Internal Server Error' });
            }
        });

        // ==================== Admin Routes ====================
        app.get('/admin/users', verifyJWT, verifyRole('admin'), async (req, res) => {
            try {
                const users = await userCollection.find().toArray();
                res.send(users);
            } catch (error) {
                console.error('Error fetching users:', error);
                res.status(500).send({ error: 'Internal Server Error' });
            }
        });

        app.patch('/admin/users/:email', verifyJWT, verifyRole('admin'), async (req, res) => {
            try {
                const email = req.params.email;
                const { role } = req.body;

                const result = await userCollection.updateOne(
                    { email },
                    { $set: { role } }
                );

                if (result.modifiedCount === 0) {
                    return res.status(404).send({ error: 'User not found' });
                }

                res.send({ message: 'User role updated successfully' });
            } catch (error) {
                console.error('Error updating user:', error);
                res.status(500).send({ error: 'Internal Server Error' });
            }
        });

        app.get('/admin/stats', verifyJWT, verifyRole('admin'), async (req, res) => {
            try {
                const [
                    totalRooms,
                    availableRooms,
                    totalUsers,
                    totalMembers
                ] = await Promise.all([
                    apartmentCollection.countDocuments(),
                    apartmentCollection.countDocuments({ status: 'available' }),
                    userCollection.countDocuments({ role: 'user' }),
                    userCollection.countDocuments({ role: 'member' })
                ]);

                
                const availablePercentage = totalRooms > 0 
                    ? (availableRooms / totalRooms) * 100 
                    : 0;
                const occupiedPercentage = totalRooms > 0 
                    ? ((totalRooms - availableRooms) / totalRooms) * 100 
                    : 0;

                res.send({
                    success: true,
                    data: {
                        totalRooms,
                        availableRoomsPercentage: availablePercentage,
                        occupiedRoomsPercentage: occupiedPercentage,
                        totalUsers,
                        totalMembers
                    }
                });
            } catch (error) {
                console.error('Error fetching stats:', error);
                res.status(500).send({ 
                    success: false,
                    error: 'Internal Server Error',
                    message: 'Failed to retrieve admin statistics'
                });
            }
        });

        
        app.get('/', (req, res) => {
            res.send('Building Management System server is running');
        });

    } catch (error) {
        console.error('Server startup error:', error);
    }
}

run().catch(console.dir);

app.listen(port, () => {
    console.log(`Building Management Server is running on port: ${port}`);
});