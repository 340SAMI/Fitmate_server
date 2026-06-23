const express = require('express');
const cors = require('cors');
const app = express();
const port = 5000;
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Hello World!');
});



const uri =process.env.MONGO_DB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();


    const database = client.db('feetmate');
    const classCollections = database.collection('classes');
//class related
    app.post('/api/classes', async (req, res) => {
      try {
        const newClass = req.body;
        if (!newClass) {
          return res.status(400).json({ error: 'Class data is required' });
        }

        const result = await classCollections.insertOne(newClass);
        res.status(201).json({ message: 'Class created', id: result.insertedId });
      } catch (error) {
        console.error('Failed to create class:', error);
        res.status(500).json({ error: 'Failed to create class' });
      }
    });

    app.get('/api/classes', async (req, res) => {
      try {
        const { search, category } = req.query;

        const query = { status: "approved" };

        if (search) {
          query.className = { $regex: search, $options: 'i' };
        }

        if (category && category !== 'all') {
          query.category = category;
        }

        const classes = await classCollections.find(query).toArray();

        res.json({ classes, total: classes.length});
    

      } catch (error) {
        console.error('Failed to fetch classes:', error);
        res.status(500).json({ error: 'Failed to fetch classes' });
      }
    });

    app.get('/api/classes/popular', async (req, res)=>{

      try{
        const classes = await classCollections.aggregate([
          
          {
            $match: { 
              status: "approved",
              bookingCount: { $gt: 0 }
            }
          },
          
          { $sort: { bookingCount: -1 }},
          
          { $limit: 6 },
          
          {
            $project: {
                className: 1,
                image: 1,
                category: 1,
                bookingCount: 1,
                price: 1
            }
          }
        ]).toArray();

        res.send(classes);

      }catch(error){
        res.status(500).send({ error: "Failed" });
      }


    })


    await client.db('admin').command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);






app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})