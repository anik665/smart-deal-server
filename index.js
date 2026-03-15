const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;

//midelwere
app.use(cors());
app.use(express.json());

//mongodb
const uri =
  "mongodb+srv://smart-deal:gF.cxM2f5DPq8Yk@cluster0.p8lzuaz.mongodb.net/smartDealDB?retryWrites=true&w=majority";

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
    app.get("/products/:id", async (req, res) => {
      const id = req.params.id;
      const querry = { _id: new ObjectId(id) };
      const result = await productsCollection.findOne(querry);
      res.send(result);
    });
    //bids releted api
    app.get("/bids", async (req, res) => {
      const email = req.query.email;
      console.log(email);
      const querry = {};
      if (email) {
        querry.buyer_email = email;
      }
      const cursor = bidsCollection.find(querry);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.post("/products", async (req, res) => {
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
app.listen(port, () => {
  console.log(`Smart deal is running on  port : ${port}`);
});
