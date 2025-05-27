const express = require('express')
const cors = require('cors');
const jwt = require("jsonwebtoken")
const app = express();
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;



app.use(cors({
    origin: ['http://localhost:5173'],
    credentials: true
}))
app.use(express.json());


const apartments = require('./apartments.json')
const coupons = require('./coupons.json')




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

const verifyRole = (requiredRole) => {
  return (req, res, next) => {
    if (req.user.role !== requiredRole) {
      return res.status(403).send('Access denied');
    }
    next();
  };
};


app.get('/admin/secure', verifyJWT, verifyRole('admin'), (req, res) => {
  res.send('Hello Admin!');
});





const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.95qfhdq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
async function run() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");


    const apartmentCollection = client.db('apartmentsDB').collection('apartments');
    const couponCollection = client.db('apartmentsDB').collection('coupons');
    await apartmentCollection.deleteMany({});
    await apartmentCollection.insertMany(apartments);
    await couponCollection.deleteMany({});
    await couponCollection.insertMany(coupons);

    //Auth related route
    app.post('/jwt', async (req, res) => {
        const user = req.body; // should include email, role, etc.
        const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
        res.send({ token });
    });

    //Get all data
    app.get('/apartments', async (req, res) => {
      try {
        const allApartments = await apartmentCollection.find().toArray();
        res.send(allApartments);
      } catch (error) {
        console.error('Error fetching apartments:', error);
        res.status(500).send('Internal Server Error');
      }
    });

    app.get('/coupons', async(req, res)=>{
        try{
            const allCoupons = await couponCollection.find().toArray();
            res.send(allCoupons);
        }catch{
            console.error('Error fetching coupons' ,error);
            res.status(500).send('Internal Server Error');
        }

    })


    //Add new data
    app.post('/apartments', async (req, res) => {
      try {
        const newApartment = req.body;
        const result = await apartmentCollection.insertOne(newApartment);
        res.status(201).send(result);
      } catch (error) {
        console.error('Error adding apartment:', error);
        res.status(500).send('Internal Server Error');
      }
    });
    app.post('/coupons', async(req, res)=>{
        try{
            const newCoupon = req.body;
            const result = await couponCollection.insertOne(newCoupon);
            res.status(201).send(result);
        }catch{
            console.error('Error Adding coupons', error);
            res.status(500).send('Internal Server Error')
        }
    })

  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res)=>{
    res.send('Building Management System server is running')
})

app.listen(port, ()=>{
    console.log(`Building Management Server is running on port: ${port}`);
})