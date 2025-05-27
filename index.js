const express = require('express')
const cors = require('cors');
const jwt = require("jsonwebtoken")
const app = express();
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;


;
app.use(cors({
    origin: ['http://localhost:5173'],
    credentials: true
}))
app.use(express.json());





app.get('/', (req, res)=>{
    res.send('Building Management System server is running')
})

app.listen(port, ()=>{
    console.log(`Building Management Server is running on port: ${port}`);
})