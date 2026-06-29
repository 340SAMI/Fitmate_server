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
    // await client.connect();


    const database = client.db('feetmate');
    const classCollections = database.collection('classes');
    const forumCollection = database.collection('forums');
    const purchaseCollection = database.collection('purchases');
    const favoriteCollection = database.collection("favorites");
    const userCollection= database.collection("user")
    const applicationCollection = database.collection("application");
    const sessionCollection = database.collection('session');


    const verifyToken = async (req, res, next) => {

        const authHeader = req.headers?.authorization;
        if (!authHeader) {
            return res.status(401).send({ message: 'unauthorized access' })
        }

        const token = authHeader.split(' ')[1]

        if (!token) {
            return res.status(401).send({ message: 'unauthorized access' })
        }

        const query = { token: token }
        const session = await sessionCollection.findOne(query);

        if (!session) {
            return res.status(401).send({ message: 'unauthorized access' })
        }

        const userId = session.userId;


        const userQuery = {
            _id: userId
        }

        const user = await userCollection.findOne(userQuery);
        if (!user) {
            return res.status(401).send({ message: 'unauthorized access' })
        }
        // set data in the req object
        req.user = user;
        next();
    }


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
        const { search, category, trainerId, isAdmin, status } = req.query;

        const query = {};

        if (search) {
          query.className = { $regex: search, $options: 'i' };
        }

        if (category && category !== 'all') {
          query.category = category;
        }

        if (trainerId) {
          query.trainerId = trainerId;          // trainer sees only their classes
        } else if (!isAdmin) {
          query.status = 'approved';            // public sees only approved
        }
        // admin: no trainerId, isAdmin=true → no status filter, sees everything

        // optional: admin can filter by status via dropdown
        if (isAdmin && status && status !== 'all') {
          query.status = status;
        }

        const classes = await classCollections.find(query).toArray();
        res.json({ classes, total: classes.length });

      } catch (error) {
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

    app.patch('/api/classes/:id', async (req, res) => {
      try {
        const { id } = req.params;
        const { isAdmin } = req.query;  // ?isAdmin=true from frontend
        const updates = req.body;
        delete updates._id;

        if (updates.status && !isAdmin) {
          delete updates.status;
        }

        const result = await classCollections.updateOne(
          { _id: new ObjectId(id) },
          { $set: updates }
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ error: 'Class not found' });
        }

        res.json({ message: 'Class updated' });
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
      }
    });

    app.delete('/api/classes/:id', async (req, res) => {
      try {
        const result = await classCollections.deleteOne({
          _id: new ObjectId(req.params.id)
        });

        if (result.deletedCount === 0) {
          return res.status(404).json({ error: 'Class not found' });
        }

        res.json({ message: 'Class deleted' });
      } catch(err) {
        console.error(err)
        res.status(500).json({ message: err.message });
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
            const { search, authorId } = req.query;
            const query = {};

            if (authorId) query.authorId = authorId;
            if (search) {
              query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { authorName: { $regex: search, $options: 'i' } },
              ];
            }

            const posts = await forumCollection.find(query).sort({ createdAt: -1 }).toArray();
            res.json({ posts, total: posts.length });
          } catch (error) {
            res.status(500).json({ error: 'Failed to fetch posts' });
          }
        });

          app.get('/api/forum/:id', async (req, res) => {
            try {
              const { id } = req.params;

              console.log("Valid:", ObjectId.isValid(id));

              const result = await forumCollection.findOne({
                _id: new ObjectId(id)
              });

              console.log("Result:", result);

              res.json(result);

            } catch (error) {
              console.error(error); 
              res.status(400).json({
                message: "Invalid ID"
              });
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

          //forum detail page

            // PATCH like
            app.patch('/api/forum/:id/like', async (req, res) => {
              try {
                const { userId } = req.body;
                const post = await forumCollection.findOne({ _id: new ObjectId(req.params.id) });
                if (!post) return res.status(404).json({ error: 'Post not found' });

                const alreadyLiked = post.likes?.includes(userId);
                const update = alreadyLiked
                  ? { $pull: { likes: userId } }                          // unlike
                  : { $addToSet: { likes: userId }, $pull: { dislikes: userId } }; // like + remove dislike

                await forumCollection.updateOne({ _id: new ObjectId(req.params.id) }, update);
                res.json({ liked: !alreadyLiked });
              } catch (error) {
                res.status(500).json({ error: 'Failed to update like' });
              }
            });

            // PATCH dislike
            app.patch('/api/forum/:id/dislike', async (req, res) => {
              try {
                const { userId } = req.body;
                const post = await forumCollection.findOne({ _id: new ObjectId(req.params.id) });
                if (!post) return res.status(404).json({ error: 'Post not found' });

                const alreadyDisliked = post.dislikes?.includes(userId);
                const update = alreadyDisliked
                  ? { $pull: { dislikes: userId } }                              // un-dislike
                  : { $addToSet: { dislikes: userId }, $pull: { likes: userId } }; // dislike + remove like

                await forumCollection.updateOne({ _id: new ObjectId(req.params.id) }, update);
                res.json({ disliked: !alreadyDisliked });
              } catch (error) {
                res.status(500).json({ error: 'Failed to update dislike' });
              }
            });

            // PATCH add comment
            app.patch('/api/forum/:id/comment', async (req, res) => {
              try {
                const { userId, userName, userImage, text } = req.body;
                if (!text?.trim()) return res.status(400).json({ error: 'Comment text is required' });

                const comment = {
                  _id: new ObjectId().toString(),
                  userId,
                  userName,
                  userImage,
                  text,
                  createdAt: new Date(),
                };

                await forumCollection.updateOne(
                  { _id: new ObjectId(req.params.id) },
                  { $push: { comments: comment } }
                );
                res.status(201).json(comment);
              } catch (error) {
                res.status(500).json({ error: 'Failed to add comment' });
              }
            });

            // PATCH edit comment
            app.patch('/api/forum/:id/comment/:commentId', async (req, res) => {
              try {
                const { text, userId } = req.body;
                await forumCollection.updateOne(
                  { _id: new ObjectId(req.params.id), 'comments._id': req.params.commentId, 'comments.userId': userId },
                  { $set: { 'comments.$.text': text, 'comments.$.editedAt': new Date() } }
                );
                res.json({ message: 'Comment updated' });
              } catch (error) {
                res.status(500).json({ error: 'Failed to edit comment' });
              }
            });

            // DELETE comment
            app.delete('/api/forum/:id/comment/:commentId', async (req, res) => {
              try {
                const { userId } = req.body;
                await forumCollection.updateOne(
                  { _id: new ObjectId(req.params.id) },
                  { $pull: { comments: { _id: req.params.commentId, userId } } }
                );
                res.json({ message: 'Comment deleted' });
              } catch (error) {
                res.status(500).json({ error: 'Failed to delete comment' });
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
            const { userId, classId, search } = req.query;
            const query = {};

            if (userId) query.userId = userId;
            if (classId) query.classId = classId;
            if (search) {
              query.$or = [
                { userEmail: { $regex: search, $options: 'i' } },
                { name:      { $regex: search, $options: 'i' } },
              ];
            }

            const purchases = await purchaseCollection.find(query).sort({ createdAt: -1 }).toArray();
            res.json({ purchases, total: purchases.length });
          } catch (error) {
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


          //STATS SECTION

          app.get('/api/trainer/stats/:trainerId', async (req, res) => {
            try {
              const { trainerId } = req.params;

              const classes = await classCollections
                .find({ trainerId })
                .toArray();

              const totalClasses  = classes.length;
              const totalEnrolled = classes.reduce(
                (sum, c) => sum + (c.bookingCount ?? 0), 0
              );

              res.json({ totalClasses, totalEnrolled });
            } catch {
              res.status(500).json({ error: 'Failed to fetch stats' });
            }
          });

            app.get("/api/admin/stats/:adminId", async (req, res) => {
              try {
                const { adminId } = req.params;


                const [totalUsers, totalClasses, totalBookings] = await Promise.all([
                  userCollection.countDocuments(),
                  classCollections.countDocuments(),
                  purchaseCollection .countDocuments(),
                ]);

                res.send({
                  success: true,
                  totalUsers,
                  totalClasses,
                  totalBookings,
                });
              } catch (err) {
                console.error(err);

                res.status(500).send({
                  success: false,
                  message: err.message,
                });
              }
            });

          app.get('/api/user/stats/:userId', async (req, res) => {
            try {
              const { userId } = req.params;

              const [totalBooked, totalFavorites] = await Promise.all([
                purchaseCollection.countDocuments({ userId }),
                favoriteCollection.countDocuments({ userId }),
              ]);

              res.json({
                success: true,
                totalBooked,
                totalFavorites,
              });
            } catch (err) {
              console.error(err);
              res.status(500).json({
                success: false,
                message: err.message,
              });
            }
          });            

          //admin part

          app.get('/api/admin/users', async (req, res) => {
            try {
              const { search, role } = req.query;
              const filter = {};

              if (role) filter.role = role;

              if (search) {
                filter.$or = [
                  { name: { $regex: search, $options: 'i' } },
                  { email: { $regex: search, $options: 'i' } }
                ];
              }

              const users = await userCollection.find(filter).toArray();
              res.json(users);
            } catch (err) {
              console.error(err);
              res.status(500).json({ error: err.message });
            }
          });


            // Block / Unblock / Make Admin
            app.patch('/api/admin/users/:id', async (req, res) => {
              try {
                const { action } = req.body;

                const updates = {
                  block: { status: 'blocked' },
                  unblock: { status: 'active' },
                  makeAdmin: { role: 'admin' },
                  demote: { role: 'user' },
                };

                if (!updates[action]) {
                  return res.status(400).json({ success: false, error: 'Invalid action' });
                }

                await userCollection.updateOne(
                  { _id: new ObjectId(req.params.id) },
                  { $set: updates[action] }
                );

                res.json({ success: true });
              } catch (err) {
                res.status(500).json({ success: false, error: err.message });
              }
            });


            //application

          app.post("/api/application", verifyToken, async (req, res) => {
            try {
              const { experience, specialty } = req.body;
              if (!experience || !specialty) {
                return res.status(400).json({ error: "Experience and specialty are required" });
              }

              const existing = await applicationCollection.findOne({
                userId: req.user._id.toString(),
                status: { $in: ["pending", "approved"] },
              });

              if (existing) {
                return res.status(409).json({ error: "You already have an active application" });
              }

              const now = new Date();

              await applicationCollection.insertOne({
                userId: req.user._id.toString(),
                fullName: req.user.name,
                email: req.user.email,
                experience: Number(experience),
                specialty,
                status: "pending",
                feedback: null,
                createdAt: now,
                updatedAt: now,
              });

              res.status(201).json({ message: "Application submitted" });
            } catch (err) {
              console.error(err);
              res.status(500).json({ error: "Server error" });
            }
          });

          app.get("/api/application", verifyToken, async (req, res) => {
            try {
              if (req.user.role === "admin") {
                const applications = await applicationCollection
                  .find({})
                  .sort({ createdAt: -1 })
                  .toArray();
                return res.status(200).json(applications);
              }

              const application = await applicationCollection.findOne(
                { userId: req.user._id.toString() },
                { sort: { createdAt: -1 } }
              );

              return res.status(200).json(application ?? {});
            } catch (err) {
              console.error(err);
              res.status(500).json({ error: "Server error" });
            }
          });

          app.patch("/api/application/:id", verifyToken, async (req, res) => {
            try {
              if (req.user.role !== "admin") {
                return res.status(403).json({ error: "Forbidden" });
              }

              const { action, feedback } = req.body;

              if (!["approve", "reject"].includes(action)) {
                return res.status(400).json({ error: "Invalid action" });
              }

              if (action === "reject" && !feedback?.trim()) {
                return res.status(400).json({ error: "Feedback is required when rejecting" });
              }

              const appId = new ObjectId(req.params.id);

              const application = await applicationCollection.findOne({ _id: appId });
              if (!application) {
                return res.status(404).json({ error: "Application not found" });
              }

              const now = new Date();

              if (action === "approve") {
                await applicationCollection.updateOne(
                  { _id: appId },
                  { $set: { status: "approved", updatedAt: now } }
                );

                await userCollection.updateOne(
                  { _id: new ObjectId(application.userId) },
                  { $set: { role: "trainer" } }
                );

                return res.status(200).json({ message: "Application approved" });
              }

              if (action === "reject") {
                await applicationCollection.updateOne(
                  { _id: appId },
                  { $set: { status: "rejected", feedback: feedback.trim(), updatedAt: now } }
                );

                return res.status(200).json({ message: "Application rejected" });
              }
            } catch (err) {
              console.error(err);
              res.status(500).json({ error: "Server error" });
            }
          });              


         

    // await client.db('admin').command({ ping: 1 });
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