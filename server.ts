/**
 * server.ts
 * 
 * Elysian Full-Stack Express Server.
 * Configures connection to MongoDB with fallback local JSON persistence,
 * exposes APIs for content state sync and GridFS file uploads, and
 * integrates Vite middleware in development or static asset serving in production.
 */

import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { MongoClient, GridFSBucket, ObjectId } from "mongodb";
import multer from "multer";
import { Readable } from "stream";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

// Fallback JSON file path when MongoDB is not connected/available
const DATA_FILE = path.join(process.cwd(), "data.json");

let db: any;
let bucket: any;

/**
 * Initializes and starts the Express web server.
 */
async function startServer() {
  const app = express();
  const PORT = 3000;

  // MongoDB Connection Setup
  const uri = process.env.MONGODB_URI;
  if (uri) {
    try {
      const client = new MongoClient(uri);
      await client.connect();
      db = client.db();
      // Initialize GridFS bucket for media/file storage inside MongoDB
      bucket = new GridFSBucket(db, { bucketName: 'uploads' });
      console.log("Connected to MongoDB successfully");
    } catch (err) {
      console.error("MongoDB connection error:", err);
    }
  } else {
    console.warn("MONGODB_URI not found. Please add it to your platform secrets. Falling back to local data.json & memory storage.");
  }

  // Middleware to parse JSON payloads with custom 50mb body limit for raw assets
  app.use(express.json({ limit: "50mb" }));

  // Multer in-memory storage configuration for handling file uploads
  const upload = multer({ storage: multer.memoryStorage() });

  // --- API Routes ---

  // Healthcheck endpoint for containers and platform ingress
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  /**
   * GET /api/data
   * Retrieves the global application state from MongoDB or falls back to data.json.
   */
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

  /**
   * POST /api/data
   * Saves the entire state object into MongoDB or local storage.
   */
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

  /**
   * POST /api/scrape-metadata
   * Scrapes external URL metadata and uses Gemini to auto-generate tube tags and description.
   */
  app.post("/api/scrape-metadata", async (req: any, res: any) => {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    console.log(`[Scrape] Attempting to scrape external link: ${url}`);
    let scrapedTitle = "";
    let scrapedDesc = "";
    let scrapedKeywords = "";
    let bodyText = "";

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const html = await response.text();

      // Extract Title
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      scrapedTitle = titleMatch ? titleMatch[1].trim() : "";

      // Extract Meta Description and Keywords using standard Regex patterns
      const descMatch = html.match(/<meta\s+[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) || 
                         html.match(/<meta\s+[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i) ||
                         html.match(/<meta\s+[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
      scrapedDesc = descMatch ? descMatch[1].trim() : "";

      const keywordsMatch = html.match(/<meta\s+[^>]*name=["']keywords["'][^>]*content=["']([^"']+)["']/i) ||
                            html.match(/<meta\s+[^>]*content=["']([^"']+)["'][^>]*name=["']keywords["']/i);
      scrapedKeywords = keywordsMatch ? keywordsMatch[1].trim() : "";

      // Extract raw snippet from body content to provide additional context
      bodyText = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .substring(0, 5000)
        .trim();
        
      console.log(`[Scrape] Fetched HTML. Title: "${scrapedTitle}", MetaDesc: "${scrapedDesc.substring(0, 50)}..."`);
    } catch (err: any) {
      console.warn(`[Scrape] Direct scraping failed (might be CORS or blocker): ${err.message}. Relying on URL breakdown for AI generation.`);
    }

    // Try to query Gemini API
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      console.warn("[Scrape] GEMINI_API_KEY is not defined in environment variables. Returning fallback metadata.");
      // Fallback if no Gemini key is provided
      const finalTitle = scrapedTitle || url.split("/").pop()?.replace(/[-_]/g, " ") || "New Tube Release";
      return res.json({
        title: finalTitle,
        description: scrapedDesc || "Exclusive video content from Elysian creators.",
        tags: scrapedKeywords ? scrapedKeywords.split(",").map(k => k.trim()) : ["Exclusive", "Recommended", "Tube", "HD"]
      });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey: geminiApiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const prompt = `You are an advanced adult/tube media classifier and SEO optimizer. 
I have scraped data from an external media link: "${url}".

Extracted metadata from the link:
- Title: "${scrapedTitle || "Unknown"}"
- Description: "${scrapedDesc || "Unknown"}"
- Keywords: "${scrapedKeywords || "Unknown"}"
- Webpage snippet text: "${bodyText.substring(0, 2000) || "Unavailable"}"

Your task is to analyze the metadata and URL details above to generate a highly engaging, professional adult-tube optimized Title, an exciting and rich content Description, and exactly 5 to 8 tags/categories (e.g. "Exclusive", "Brunette", "POV", "Amateur", "HD", "South African").
Return a clean JSON conforming to the response schema. Keep descriptions descriptive and enticing.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              tags: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ["title", "description", "tags"]
          }
        }
      });

      const resultText = response.text?.trim();
      if (resultText) {
        const parsed = JSON.parse(resultText);
        console.log("[Scrape] Gemini metadata generation succeeded!");
        return res.json(parsed);
      } else {
        throw new Error("Empty response from Gemini API");
      }
    } catch (apiErr: any) {
      console.error("[Scrape] Error calling Gemini API:", apiErr);
      const fallbackTitle = scrapedTitle || "New Tube Release";
      return res.json({
        title: fallbackTitle,
        description: scrapedDesc || "An exciting new release uploaded on Elysian.",
        tags: ["Exclusive", "Recommended", "Tube", "HD"]
      });
    }
  });

  /**
   * POST /api/upload
   * Receives binary files, pipes them into GridFS on MongoDB or returns Base64 fallback.
   */
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

  /**
   * GET /api/files/:id
   * Streams a stored GridFS media file by its unique MongoDB ObjectId.
   */
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

  // --- Front-end Integration / Asset Serving ---
  // If we are in development, integrate Vite middlewares to hot reload code changes.
  // In production, we serve static compiled files directly from the `/dist` directory.
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
