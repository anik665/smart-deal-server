const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const admin = require("firebase-admin");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();

// ======================
// Firebase Admin SDK
// ======================

const decoded = Buffer.from(process.env.FIREBASE_KEY, "base64").toString(
  "utf8",
);

const serviceAccount = JSON.parse(decoded);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// ======================
// Middleware
// ======================

app.use(cors());
app.use(express.json());

const logger = (req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
};

// ======================
// Firebase Token Verify
// ======================

const verifyFirebaseAccessToken = async (req, res, next) => {
  try {
    if (!req.headers.authorization) {
      return res.status(401).send({
        message: "Unauthorized access",
      });
    }

    const token = req.headers.authorization.split(" ")[1];

    if (!token) {
      return res.status(401).send({
        message: "Unauthorized access",
      });
    }

    const decoded = await admin.auth().verifyIdToken(token);

    req.token_email = decoded.email;

    next();
  } catch (error) {
    console.log(error);

    return res.status(401).send({
      message: "Unauthorized access",
    });
  }
};

// ======================
// JWT Verify
// ======================

const verifyJwtToken = (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).send({
      message: "Unauthorized access",
    });
  }

  const token = req.headers.authorization.split(" ")[1];

  if (!token) {
    return res.status(401).send({
      message: "Unauthorized access",
    });
  }

  jwt.verify(token, process.env.JWT_TOKEN, (err, decoded) => {
    if (err) {
      return res.status(401).send({
        message: "Unauthorized access",
      });
    }

    req.token_email = decoded.email;

    next();
  });
};

// ======================
// MongoDB Connection
// ======================

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.p8lzuaz.mongodb.net/smartDealDB?retryWrites=true&w=majority`;

let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb) {
    return cachedDb;
  }

  const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
  });

  await client.connect();

  console.log("✅ MongoDB Connected");

  cachedClient = client;
  cachedDb = client.db("productsDB");

  return cachedDb;
}

// ======================
// Collections
// ======================

async function getProductsCollection() {
  const db = await connectToDatabase();
  return db.collection("products");
}

async function getBidsCollection() {
  const db = await connectToDatabase();
  return db.collection("Bids");
}

async function getUsersCollection() {
  const db = await connectToDatabase();
  return db.collection("Users");
}

// ======================
// Root Route
// ======================

app.get("/", (req, res) => {
  res.send("Smart Deal server is running ✅");
});

// ======================
// JWT Token API
// ======================

app.post("/gettoken", (req, res) => {
  const email = req.body.email;

  const token = jwt.sign({ email }, process.env.JWT_TOKEN, {
    expiresIn: "1h",
  });

  res.send({ token });
});

// ======================
// Users API
// ======================

app.post("/users", async (req, res) => {
  try {
    const userCollection = await getUsersCollection();

    const newUser = req.body;

    const existingUser = await userCollection.findOne({
      email: newUser.email,
    });

    if (existingUser) {
      return res.send({
        message: "User already exists",
      });
    }

    const result = await userCollection.insertOne(newUser);

    res.send(result);
  } catch (error) {
    console.log(error);

    res.status(500).send({
      message: "Internal server error",
    });
  }
});

// ======================
// Products APIs
// ======================

app.get("/products", async (req, res) => {
  try {
    const productsCollection = await getProductsCollection();

    const email = req.query.email;

    const query = {};

    if (email) {
      query.email = email;
    }

    const result = await productsCollection.find(query).toArray();

    res.send(result);
  } catch (error) {
    console.log(error);

    res.status(500).send({
      message: "Internal server error",
    });
  }
});

app.get("/products/:id", async (req, res) => {
  try {
    const productsCollection = await getProductsCollection();

    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        message: "Invalid product id",
      });
    }

    const query = {
      _id: new ObjectId(id),
    };

    const result = await productsCollection.findOne(query);

    if (!result) {
      return res.status(404).send({
        message: "Product not found",
      });
    }

    res.send(result);
  } catch (error) {
    console.log(error);

    res.status(500).send({
      message: "Internal server error",
    });
  }
});

app.post("/products", verifyFirebaseAccessToken, async (req, res) => {
  try {
    const productsCollection = await getProductsCollection();

    const newProduct = req.body;

    const result = await productsCollection.insertOne(newProduct);

    res.send(result);
  } catch (error) {
    console.log(error);

    res.status(500).send({
      message: "Internal server error",
    });
  }
});

app.patch("/products/:id", async (req, res) => {
  try {
    const productsCollection = await getProductsCollection();

    const id = req.params.id;

    const updatedProduct = req.body;

    const query = {
      _id: new ObjectId(id),
    };

    const updateDoc = {
      $set: {
        name: updatedProduct.name,
        price: updatedProduct.price,
      },
    };

    const result = await productsCollection.updateOne(query, updateDoc);

    res.send(result);
  } catch (error) {
    console.log(error);

    res.status(500).send({
      message: "Internal server error",
    });
  }
});

app.delete("/products/:id", async (req, res) => {
  try {
    const productsCollection = await getProductsCollection();

    const id = req.params.id;

    const query = {
      _id: new ObjectId(id),
    };

    const result = await productsCollection.deleteOne(query);

    res.send(result);
  } catch (error) {
    console.log(error);

    res.status(500).send({
      message: "Internal server error",
    });
  }
});

// ======================
// Latest Products API
// ======================

app.get("/latest-products", async (req, res) => {
  try {
    const productsCollection = await getProductsCollection();

    const result = await productsCollection
      .find()
      .sort({
        created_at: -1,
      })
      .limit(6)
      .toArray();

    res.send(result);
  } catch (error) {
    console.log(error);

    res.status(500).send({
      message: "Internal server error",
    });
  }
});

// ======================
// Bids APIs
// ======================

app.get("/bids", logger, verifyFirebaseAccessToken, async (req, res) => {
  try {
    const bidsCollection = await getBidsCollection();

    const email = req.query.email;

    const query = {};

    if (email) {
      if (email !== req.token_email) {
        return res.status(403).send({
          message: "Forbidden access",
        });
      }

      query.buyer_email = email;
    }

    const result = await bidsCollection.find(query).toArray();

    res.send(result);
  } catch (error) {
    console.log(error);

    res.status(500).send({
      message: "Internal server error",
    });
  }
});

app.post("/bids", async (req, res) => {
  try {
    const bidsCollection = await getBidsCollection();

    const newBid = req.body;

    const result = await bidsCollection.insertOne(newBid);

    res.send(result);
  } catch (error) {
    console.log(error);

    res.status(500).send({
      message: "Internal server error",
    });
  }
});

app.get(
  "/products/bids/:productId",
  verifyFirebaseAccessToken,
  async (req, res) => {
    try {
      const bidsCollection = await getBidsCollection();

      const productId = req.params.productId;

      const query = {
        product: productId,
      };

      const result = await bidsCollection
        .find(query)
        .sort({
          bids_price: -1,
        })
        .toArray();

      res.send(result);
    } catch (error) {
      console.log(error);

      res.status(500).send({
        message: "Internal server error",
      });
    }
  },
);

app.delete("/bids/:id", async (req, res) => {
  try {
    const bidsCollection = await getBidsCollection();

    const id = req.params.id;

    const query = {
      _id: new ObjectId(id),
    };

    const result = await bidsCollection.deleteOne(query);

    res.send(result);
  } catch (error) {
    console.log(error);

    res.status(500).send({
      message: "Internal server error",
    });
  }
});

// ======================
// Graceful Shutdown
// ======================

process.on("SIGTERM", async () => {
  console.log("SIGTERM received");

  if (cachedClient) {
    await cachedClient.close();
    console.log("MongoDB connection closed");
  }

  process.exit(0);
});

// ======================
// Export App for Vercel
// ======================

module.exports = app;
