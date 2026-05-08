const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const admin = require("firebase-admin");
const jwt = require("jsonwebtoken");
const app = express();
const port = process.env.PORT || 3000;
require("dotenv").config();
// console.log(process.env);

//firebase admin sdk

// index.js
const decoded = Buffer.from(process.env.FIREBASE_KEY, "base64").toString(
  "utf8",
);
const serviceAccount = JSON.parse(decoded);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

//midelwere
app.use(cors());
app.use(express.json());

const logger = (req, res, next) => {
  console.log("login middle were information");
  next();
};

const verifyFirebaseAccessTolken = async (req, res, next) => {
  console.log("verify firebase accesstoken", req.headers.authorization);
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "unauthorized" });
  }
  const token = req.headers.authorization.split(" ")[1];
  if (!token) {
    return res.status(401).send({ message: "unauthorization access" });
  }
  try {
    const userInfo = await admin.auth().verifyIdToken(token);
    console.log("after token verified", userInfo);
    req.token_email = userInfo.email;
    next();
  } catch {
    return res.status(401).send({ message: "unauthorized" });
  }
};
//Jwt token verified

const verifieJwtToken = (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  const token = req.headers.authorization.split(" ")[1];
  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  jwt.verify(token, process.env.JWT_TOKEN, function (err, decode) {
    if (err) {
      return res.status(401).send({ message: "unauthorized" });
    }
    console.log("after verified", decode);
    //put in the right place
    req.token_email = decode.email;
    next();
  });
};

//mongodb

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.p8lzuaz.mongodb.net/smartDealDB?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    await client.connect();
    const productsDB = client.db("productsDB");
    const productsCollection = productsDB.collection("products");
    const bidsCollection = productsDB.collection("Bids");
    const userCollection = productsDB.collection("Users");

    //Jwt token releted api

    app.post("/gettoken", (req, res) => {
      const logger = req.body.email;
      console.log(logger);
      const token = jwt.sign({ email: logger }, process.env.JWT_TOKEN, {
        expiresIn: "1h",
      });
      res.send({ token: token });
    });

    //user api
    app.post("/users", async (req, res) => {
      const newUser = req.body;
      const existingUser = await userCollection.insertOne({
        email: newUser.email,
      });
      if (existingUser) {
        return res.send({ message: "user already exit " });
      } else {
        const result = await userCollection.insertOne(newUser);
        res.send(result);
      }
    });
    //products api
    app.get("/products", async (req, res) => {
      // const spetial = { title: 1 };

      const email = req.query.email;
      const query = {};
      if (email) {
        query.email = email;
      }
      const cursor = productsCollection.find(query);
      // .sort({ price_min: 1 })
      // .skip(2)
      // .limit(2)
      // .project(spetial);
      console.log(req.query);
      const result = await cursor.toArray();
      res.send(result);
    });
    const { ObjectId } = require("mongodb");

    app.get("/products/:id", async (req, res) => {
      try {
        const id = req.params.id;

        // check valid ObjectId
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ error: "Invalid ID" });
        }

        const query = { _id: id };
        const result = await productsCollection.findOne(query);

        if (!result) {
          return res.status(404).send({ error: "Product not found" });
        }

        res.send(result);
      } catch (error) {
        res.status(500).send({ error: "Server error" });
      }
    });
    //bids releted api

    // app.get("/bids", verifieJwtToken, async (req, res) => {
    //   const email = req.query.email;
    //   const querry = {};
    //   if (email) {
    //     querry.buyer_email = email;
    //   }
    //   if (email !== req.token_email) {
    //     return res.status(403).send({ message: "forbiddne access" });
    //   }
    //   const cursor = bidsCollection.find(querry);
    //   const result = await cursor.toArray();
    //   res.send(result);
    // });

    app.get("/bids", logger, verifyFirebaseAccessTolken, async (req, res) => {
      // console.log("headers", req.headers);
      const email = req.query.email;
      console.log(email);
      const querry = {};
      if (email) {
        if (email !== req.token_email) {
          return res.status(403).send({ message: "Forbiden" });
        }
        querry.buyer_email = email;
      }
      const cursor = bidsCollection.find(querry);
      const result = await cursor.toArray();
      res.send(result);
    });
    app.post("/bids", async (req, res) => {
      const newBids = req.body;
      const result = await bidsCollection.insertOne(newBids);
      res.send(result);
    });
    app.get(
      "/products/bids/:productId",
      verifyFirebaseAccessTolken,
      async (req, res) => {
        const productId = req.params.productId;
        const querry = { product: productId };
        const cursor = bidsCollection.find(querry).sort({ bids_price: -1 });
        const result = await cursor.toArray();
        res.send(result);
      },
    );
    app.delete("/bids/:id", async (req, res) => {
      const id = req.params.id;
      const querry = { _id: new ObjectId(id) };
      const result = await bidsCollection.deleteOne(querry);
      res.send(result);
    });
    // latest products apis
    app.get("/latest-products", async (req, res) => {
      const cursor = productsCollection
        .find()
        .sort({
          created_at: -1,
        })
        .limit(6);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.post("/products", verifyFirebaseAccessTolken, async (req, res) => {
      const newProducts = req.body;
      const result = await productsCollection.insertOne(newProducts);
      res.send(result);
    });
    app.delete("/products/:id", async (req, res) => {
      const id = req.params.id;
      const querry = { _id: new ObjectId(id) };
      const result = await productsCollection.deleteOne(querry);
      res.send(result);
    });
    app.patch("/products/:id", async (req, res) => {
      const id = req.params.id;
      const updateProducts = req.body;
      const querry = { _id: new ObjectId(id) };
      const update = {
        $set: {
          name: updateProducts.name,
          price: updateProducts.price,
        },
      };
      const result = await productsCollection.updateOne(querry, update);
      res.send(result);
    });
    console.log("✅ MongoDB connected successfully");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error);
  }
}
run();

app.get("/", (req, res) => {
  res.send("Smart deal is  running on the port 3000");
});
// app.listen(port, () => {
//   console.log(`Smart deal is running on  port : ${port}`);
// });
