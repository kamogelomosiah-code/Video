import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { MongoClient, GridFSBucket, ObjectId } from "mongodb";
import multer from "multer";
import { Readable } from "stream";
import dotenv from "dotenv";

dotenv.config();

const DATA_FILE = path.join(process.cwd(), "data.json");

let db: any;
let bucket: any;

async function startServer() {
  const app = express();
  const PORT = 3000;

  // MongoDB Connection
  const uri = process.env.MONGODB_URI;
  if (uri) {
    try {
      const client = new MongoClient(uri);
      await client.connect();
      db = client.db();
      bucket = new GridFSBucket(db, { bucketName: 'uploads' });
      console.log("Connected to MongoDB successfully");
    } catch (err) {
      console.error("MongoDB connection error:", err);
    }
  } else {
    console.warn("MONGODB_URI not found. Please add it to your platform secrets. Falling back to local data.json & memory storage.");
  }

  // Middleware
  app.use(express.json({ limit: "50mb" }));

  const upload = multer({ storage: multer.memoryStorage() });

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/data", async (req, res) => {
    if (db) {
      try {
        const state = await db.collection('state').findOne({ _id: 'global_state' });
        res.json(state ? state.data : {});
      } catch (err) {
        console.error("Error reading from MongoDB:", err);
        res.json({});
      }
    } else if (fs.existsSync(DATA_FILE)) {
      try {
        const data = fs.readFileSync(DATA_FILE, "utf-8");
        res.json(JSON.parse(data));
      } catch (err) {
        console.error("Error reading data.json:", err);
        res.json({});
      }
    } else {
      res.json({});
    }
  });

  app.post("/api/data", async (req, res) => {
    if (db) {
      try {
        await db.collection('state').updateOne(
          { _id: 'global_state' },
          { $set: { data: req.body } },
          { upsert: true }
        );
        res.json({ success: true });
      } catch (err) {
        console.error("Error writing to MongoDB:", err);
        res.status(500).json({ error: "Failed to save data to MongoDB" });
      }
    } else {
      try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(req.body, null, 2), "utf-8");
        res.json({ success: true });
      } catch (err) {
        console.error("Error writing data.json:", err);
        res.status(500).json({ error: "Failed to save data locally" });
      }
    }
  });

  app.post("/api/upload", upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    if (bucket) {
      const readablePhotoStream = new Readable();
      readablePhotoStream.push(req.file.buffer);
      readablePhotoStream.push(null);

      const uploadStream = bucket.openUploadStream(req.file.originalname, {
        contentType: req.file.mimetype
      });
      readablePhotoStream.pipe(uploadStream);

      uploadStream.on("error", () => {
        res.status(500).json({ error: "Upload failed" });
      });

      uploadStream.on("finish", () => {
        res.json({ url: `/api/files/${uploadStream.id}` });
      });
    } else {
      // Fallback if no MongoDB (just return a local blob URL or dummy for demo purposes)
      // Since it's server-side, returning a blob is incorrect. 
      // We'll return a base64 encoded string so it works locally as well.
      const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
      res.json({ url: base64 });
    }
  });

  app.get("/api/files/:id", async (req, res) => {
    if (!bucket) return res.status(404).send("MongoDB not configured");
    try {
      const id = new ObjectId(req.params.id);
      const downloadStream = bucket.openDownloadStream(id);
      downloadStream.pipe(res);
      downloadStream.on("error", () => res.status(404).send("File not found"));
    } catch (e) {
      res.status(400).send("Invalid ID");
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
