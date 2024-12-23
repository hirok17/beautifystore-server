const express =require('express');
const app =express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const port=process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

   // middelware jwt.verify
   const verifyToken =(req, res, next)=>{
    const authorization =req.headers.authorization;

    if(!authorization){
      return res.status(401).send({message:'forbaiden access'});
    }
    const token =authorization.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_KEY_TOKEN, (err, decoded)=>{
      if(err){
        return res.status(401).send({message:'forbaiden access'});
      }
      req.decoded =decoded;
      next();
    })
   };

   // verify seller
   const verifySeller = async(req, res, next)=>{
    const email =req.decoded.email;
    const query ={email: email};
    const user =await userCollection.findOne(query);
    const isSeller =user?.role === 'seller';
    if(!isSeller){
      return res.status(401).send({message:'forbaiden access'});
    }
    next();
   };

// mongodb
const url=`mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.4cojmrb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(url, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    }
  });

  //DB collection
  const userCollection =client.db('beautifyStore').collection('users');
  const productCollection =client.db('beautifyStore').collection('products');

  async function run() {
    try {
      // Connect the client to the server	(optional starting in v4.7)
      await client.connect();

      //user insert api
      app.post('/users', async(req, res)=>{
        const user =req.body;
        const query ={email: user.email};
        const existingUser =await userCollection.findOne(query);
        if(existingUser){
          return res.send({message: 'user already exist',});
        }
        const result =await userCollection.insertOne(user);
        res.send(result);
      });

      //user get
      app.get('/user/:email', async(req, res)=>{
        const email=req.params.email;
        const query ={email: email};
        const result =await userCollection.findOne(query);
        res.send(result);
      })

      // add product
      app.post('/products', verifyToken, verifySeller, async(req, res)=>{
        const item =req.body;
        const result =await productCollection.insertOne(item);
        res.send(result);
      })

      // get products
      app.get('/all-products', async(req, res)=>{
        const {title, sort, category, brand} =req.query;
        const query ={};
        if(title){
          query.title ={ $regex: title, $options: 'i'};
        }
        if(category){
          query.category ={ $regex: category, $options: 'i'};
        }
        if(brand){
          query.brand =brand;
        }

        const sortOption =sort === 'asc' ? 1 : -1;

        const products =await productCollection.find(query).sort({price: sortOption}).toArray();
        const totallproducts =await productCollection.countDocuments(query);

        const productdata = await productCollection.find({}, {projection:{category:1, brand:1}}).toArray();

        const categories =[...new Set(productdata.map(product=>product.category))];
        const brands =[...new Set(productdata.map(product=>product.brand))];
        res.send({products, categories, brands, totallproducts});
      });

      // wishlist add
      app.patch('/wishlist', verifyToken, async(req, res)=>{
        const {userEmail, productId} =req.body;

        const result =await userCollection.updateOne(
          {email: userEmail},
          {$addToSet: {wishlist: new ObjectId(String(productId))}}
        );
        res.send(result);
      });

      //get wishlist
      app.get('/wishlist/:userId', verifyToken, async(req, res)=>{
        const userId =req.params.userId;
        const user =await userCollection.findOne({
          _id: new ObjectId(String(userId))
        })
        if(!user){
          return res.send({message:'user not found'})
        }
        const wishList =await productCollection.find({_id: {$in: user.wishlist || []}}).toArray();
        res.send(wishList);
      })



      // Send a ping to confirm a successful connection
      await client.db("admin").command({ ping: 1 });
      console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } catch(error){
        console.log(error.name, error.message);
    }
  }
  run().catch(console.dir);
  
//api list
//1st jwt token build
app.post('/jwt', (req, res)=>{
  const userEmail=req.body;
  const token=jwt.sign(userEmail, process.env.ACCESS_KEY_TOKEN, {expiresIn:'1d'});
  res.send({token});
})
app.get('/', (req, res)=>{
    res.send('server is now running good');
});

app.listen(port, ()=>{
    console.log(`servar is on port ${port}`);
});