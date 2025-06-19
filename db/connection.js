const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.95qfhdq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function connectToDatabase() {
  try {
    // Connect the client to the server
    await client.connect();
    console.log("Connected to MongoDB");
    
    // Initialize collections and seed data if needed
    await initializeCollections();
    
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
}

async function initializeCollections() {
  const db = client.db("buildingDB");
  
  // Initialize coupons
  const couponsFromJson = require('../coupons.json');
  const couponCollection = db.collection("coupons");
  const couponCount = await couponCollection.estimatedDocumentCount();
  if (couponCount === 0) {
    await couponCollection.insertMany(couponsFromJson);
    console.log('Coupons seeded');
  }

  // Initialize apartments
  const apartments = require('../apartments.json');
  const apartmentCollection = db.collection("apartments");
  const apartmentCount = await apartmentCollection.estimatedDocumentCount();
  if (apartmentCount === 0) {
    await apartmentCollection.insertMany(apartments);
    console.log('Apartments seeded');
  }
}

function getDb() {
  return client.db("buildingDB");
}

module.exports = {
  connectToDatabase,
  getDb
};