const express = require('express');
const cors = require('cors');
const app = express();
const port = 5000;
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'FeetMate API is running', status: 'ok' });
});



const uri = process.env.MONGO_DB_URI;

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
    const forumCollection = database.collection('forums');
    const purchaseCollection = database.collection('purchases');
    const favoriteCollection = database.collection("favorites")
//class related
    app.post('/api/classes', async (req, res) => {
      try {
        const newClass = req.body;
        if (!newClass || Object.keys(newClass).length === 0) {
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

        res.json({classes, total:classes.length});
    

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
                price: 1,
                trainerName:1
            }
          }
        ]).toArray();

        res.json(classes);

      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch popular classes' });
      }


    })

      app.get('/api/classes/:id', async (req, res) => {
      try {
        const id = req.params.id;

        const query = {
          _id: new ObjectId(id)
        };

        const result = await classCollections.findOne(query);

        res.json(result)

      } catch (error) {
        res.status(400).json({
          success: false,
          message: 'Invalid ID'
        });
      }
    });

    //forum apis

      app.post('/api/forum', async (req, res) => {
          try {
            const newForum = req.body;
            if (!newForum || Object.keys(newForum).length === 0) {
              return res.status(400).json({ error: 'Forum data is required' });
            }

            const result = await forumCollection.insertOne(newForum);
            res.status(201).json({ message: 'forum created', id: result.insertedId });
          } catch (error) {
            console.error('Failed to create forum:', error);
            res.status(500).json({ error: 'Failed to create forum' });
          }
        });
                      //this one detects id and give their own forums
        app.get('/api/forum', async (req, res) => {
          try {
            const { authorId } = req.query; //req.query.authorId

            const query = {};
            if (authorId){
              query.authorId = authorId;
            } 

            const posts = await forumCollection.find(query).sort({ createdAt: -1 }).toArray();
            res.json({posts, total:posts.length});
          } catch (error) {
            console.error('Failed to fetch forum posts:', error);
            res.status(500).json({ error: 'Failed to fetch forum posts' });
          }
        });

          app.delete('/api/forum/:id', async (req, res) => {
            try {
              
              const result = await forumCollection.deleteOne({ _id: new ObjectId(req.params.id) });
              if (result.deletedCount === 0) return res.status(404).json({ error: 'Post not found' });
              res.json({ message: 'Post deleted' });
            } catch (error) {
              res.status(500).json({ error: 'Failed to delete post' });
            }
          });


          //purchase 

          app.post('/api/purchases', async (req, res) => {
            try {
              const purchaseData = req.body;

              if (!purchaseData || Object.keys(purchaseData).length === 0) {
                return res.status(400).json({ error: 'Purchase data is required' });
              }

              const purchaseDoc = {
                ...purchaseData,
                createdAt: new Date()
              };

              const result = await purchaseCollection.insertOne(purchaseDoc);

              if (ObjectId.isValid(purchaseDoc.classId)) {
                await classCollections.updateOne(
                  { _id: new ObjectId(purchaseDoc.classId) },
                  { $inc: { bookingCount: 1 } }
                );
              }

              res.status(201).json(purchaseDoc);
            } catch (error) {
              console.error('Failed to create purchase:', error);
              res.status(500).json({ error: 'Failed to create purchase' });
            }
          });

          app.get('/api/purchases', async (req, res) => {
            try {
              const { userId, classId} = req.query;
              const query = {};

              if (userId){
                query.userId = userId;
              } 

              if(classId){
                query.classId = classId
              }         

              const purchases = await purchaseCollection.find(query).sort({ createdAt: -1 }).toArray();

              res.json({ purchases, total: purchases.length });
            } catch (error) {
              console.error('Failed to fetch purchases:', error);
              res.status(500).json({ error: 'Failed to fetch purchases' });
            }
          });


          app.get('/api/purchases/check', async (req, res) => {

            const { userId, classId } = req.query;

            const purchase = await purchaseCollection.findOne({
              userId,
              classId
            });

            res.json({
              booked: !!purchase
            });
          });

            // favorites
            app.post('/api/favorites', async (req, res) => {
              try {
                const favoriteData = req.body;

                if (!favoriteData || Object.keys(favoriteData).length === 0) {
                  return res.status(400).json({
                    error: 'Favorite data is required'
                  });
                }

                const { classId, userId } = favoriteData;

                const existingFavorite = await favoriteCollection.findOne({
                  classId,  
                  userId
                });

                if (existingFavorite) {
                  return res.status(409).json({
                    message: 'Class already added to favorites'
                  });
                }

                const result = await favoriteCollection.insertOne({
                  ...favoriteData,
                  createdAt: new Date()
                });

                res.status(201).json(result);

              } catch (error) {
                console.error('Failed to add favorite:', error);
                res.status(500).json({
                  error: 'Failed to add favorite'
                });
              }
            });

          app.get('/api/favorites', async (req, res)=>{
            try{
              const {userId, classId} = req.query;
              const query = {}
              if(userId){
                query.userId = userId;
              }
              if(classId){
                query.classId = classId;
              }

              const favorites = await favoriteCollection.find(query).toArray();

              res.json({
                favorites,
                total: favorites.length
              });
            }catch(err){
                  console.error('Failed to get favorite:', err);
                  res.status(500).json({
                      error: 'Failed to get favorite'
                   });
            }
          })

          app.delete('/api/favorites', async (req, res) => {
            try {

              const { userId, classId } = req.query;

              const result = await favoriteCollection.deleteOne({
                userId,
                classId
              });

              res.json(result);

            } catch (err) {

              console.error('Failed to delete favorite:', err);

              res.status(500).json({
                error: 'Failed to delete favorite'
              });

            }
          });
          

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