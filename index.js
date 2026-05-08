const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const admin = require("firebase-admin");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();

// ✅ Firebase Admin SDK
const decoded = Buffer.from(process.env.FIREBASE_KEY, "base64").toString(
  "utf8",
);
const serviceAccount = JSON.parse(decoded);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// ✅ Middleware
app.use(cors());
app.use(express.json());

// ✅ Logger Middleware
const logger = (req, res, next) => {
  console.log("Request:", req.method, req.url);
  next();
};

// ✅ Firebase Token Verify
const verifyFirebaseAccessToken = async (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "Unauthorized" });
  }
  const token = req.headers.authorization.split(" ")[1];
  if (!token) {
    return res.status(401).send({ message: "Unauthorized" });
  }
  try {
    const userInfo = await admin.auth().verifyIdToken(token);
    req.token_email = userInfo.email;
    next();
  } catch {
    return res.status(401).send({ message: "Unauthorized" });
  }
};

// ✅ JWT Token Verify
const verifyJwtToken = (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "Unauthorized" });
  }
  const token = req.headers.authorization.split(" ")[1];
  if (!token) {
    return res.status(401).send({ message: "Unauthorized" });
  }
  jwt.verify(token, process.env.JWT_TOKEN, (err, decode) => {
    if (err) {
      return res.status(401).send({ message: "Unauthorized" });
    }
    req.token_email = decode.email;
    next();
  });
};

// ✅ MongoDB setup
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.p8lzuaz.mongodb.net/smartDealDB?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let isConnected = false;

async function connectDB() {
  if (!isConnected) {
    await client.connect();
    isConnected = true;
    console.log("✅ MongoDB connected");
  }
}

const productsDB = client.db("productsDB");
const productsCollection = productsDB.collection("products");
const bidsCollection = productsDB.collection("Bids");
const userCollection = productsDB.collection("Users");

// ✅ Root route
app.get("/", (req, res) => {
  res.send("Smart Deal server is running ✅");
});

// ✅ JWT token
app.post("/gettoken", (req, res) => {
  const email = req.body.email;
  const token = jwt.sign({ email }, process.env.JWT_TOKEN, { expiresIn: "1h" });
  res.send({ token });
});

// ✅ Users
app.post("/users", async (req, res) => {
  try {
    await connectDB();
    const newUser = req.body;
    const existing = await userCollection.findOne({ email: newUser.email });
    if (existing) {
      return res.send({ message: "User already exists" });
    }
    const result = await userCollection.insertOne(newUser);
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Server error" });
  }
});

// ✅ Get all products or by email
app.get("/products", async (req, res) => {
  try {
    await connectDB();
    const email = req.query.email;
    const query = email ? { email } : {};
    const result = await productsCollection.find(query).toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Server error" });
  }
});

// ✅ Latest products
app.get("/latest-products", async (req, res) => {
  try {
    await connectDB();
    const result = await productsCollection
      .find()
      .sort({ created_at: -1 })
      .limit(6)
      .toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Server error" });
  }
});

// ✅ Get product by ID — must be before /products/:id wildcard conflict
app.get(
  "/products/bids/:productId",
  verifyFirebaseAccessToken,
  async (req, res) => {
    try {
      await connectDB();
      const productId = req.params.productId;
      const result = await bidsCollection
        .find({ product: productId })
        .sort({ bids_price: -1 })
        .toArray();
      res.send(result);
    } catch (error) {
      res.status(500).send({ error: "Server error" });
    }
  },
);

app.get("/products/:id", async (req, res) => {
  try {
    await connectDB();
    const id = req.params.id;
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ error: "Invalid ID" });
    }
    const result = await productsCollection.findOne({ _id: new ObjectId(id) });
    if (!result) {
      return res.status(404).send({ error: "Product not found" });
    }
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Server error" });
  }
});

// ✅ Add product
app.post("/products", verifyFirebaseAccessToken, async (req, res) => {
  try {
    await connectDB();
    const result = await productsCollection.insertOne(req.body);
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Server error" });
  }
});

// ✅ Update product
app.patch("/products/:id", async (req, res) => {
  try {
    await connectDB();
    const id = req.params.id;
    const { name, price } = req.body;
    const result = await productsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { name, price } },
    );
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Server error" });
  }
});

// ✅ Delete product
app.delete("/products/:id", async (req, res) => {
  try {
    await connectDB();
    const id = req.params.id;
    const result = await productsCollection.deleteOne({
      _id: new ObjectId(id),
    });
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Server error" });
  }
});

// ✅ Get bids
app.get("/bids", logger, verifyFirebaseAccessToken, async (req, res) => {
  try {
    await connectDB();
    const email = req.query.email;
    const query = {};
    if (email) {
      if (email !== req.token_email) {
        return res.status(403).send({ message: "Forbidden" });
      }
      query.buyer_email = email;
    }
    const result = await bidsCollection.find(query).toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Server error" });
  }
});

// ✅ Add bid
app.post("/bids", async (req, res) => {
  try {
    await connectDB();
    const result = await bidsCollection.insertOne(req.body);
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Server error" });
  }
});

// ✅ Delete bid
app.delete("/bids/:id", async (req, res) => {
  try {
    await connectDB();
    const id = req.params.id;
    const result = await bidsCollection.deleteOne({ _id: new ObjectId(id) });
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Server error" });
  }
});

module.exports = app;
