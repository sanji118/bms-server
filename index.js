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
    await apartmentCollection.deleteMany({});
    await apartmentCollection.insertMany(apartments);


    app.get('/apartments', async(req, res)=>{
        const newApartment = req.body;
        const result = await apartmentCollection.insertOne(newApartment);
        res.send(result);
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