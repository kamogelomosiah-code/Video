/**
 * server.ts
 * 
 * Elysian Full-Stack Express Server.
 * Configures connection to MongoDB with fallback local JSON persistence,
 * exposes APIs for content state sync and GridFS file uploads, and
 * integrates Vite middleware in development or static asset serving in production.
 */

import express, { Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs/promises";
import { createReadStream, existsSync } from "fs";
import { createServer as createViteServer } from "vite";
import { MongoClient, GridFSBucket, ObjectId, Db } from "mongodb";
import multer from "multer";
import { Readable } from "stream";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

dotenv.config({ override: true });
dotenv.config({ path: ".env.local", override: true });
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const ADMIN_KEY = process.env.ADMIN_KEY || "";
const UPLOAD_DIR = path.join(process.cwd(), "uploads");

const scryptAsync = promisify(scrypt);
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DATA_FILE = path.join(process.cwd(), "data.json");

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const hashBuf = Buffer.from(hash, "hex");
  const attemptBuf = (await scryptAsync(password, salt, 64)) as Buffer;
  if (hashBuf.length !== attemptBuf.length) return false;
  return timingSafeEqual(hashBuf, attemptBuf);
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36).slice(-4);
}

let jsonDB: any = null;
async function loadJsonDB(): Promise<any> {
  if (jsonDB) return jsonDB;
  jsonDB = { media: [], users: [], talentProfiles: [], messages: [], notifications: [], comments: [], activityLogs: [], sessions: [], siteSettings: {} };
  try {
    if (existsSync(DATA_FILE)) {
      jsonDB = { ...jsonDB, ...JSON.parse(await fs.readFile(DATA_FILE, "utf-8")) };
    }
  } catch (e: any) {
    console.error("[db] Failed to read data.json:", e.message);
  }
  return jsonDB;
}

async function saveJsonDB(): Promise<void> {
  if (!jsonDB) return;
  const tmp = DATA_FILE + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(jsonDB, null, 2), "utf-8");
  await fs.rename(tmp, DATA_FILE);
}

let mongo: any = null;
let db: any = null;
let bucket: any = null;

async function findOneByField<T = any>(name: string, field: string, value: any): Promise<T | null> {
  if (mongo) return mongo.collection(name).findOne({ [field]: value }) as any;
  const dbInst = await loadJsonDB();
  return ((dbInst as any)[name] as any[] || []).find((d) => d[field] === value) || null;
}

async function upsertDoc<T extends { id: string }>(name: string, doc: T): Promise<T> {
  if (mongo) {
    await mongo.collection(name).updateOne({ id: doc.id }, { $set: doc }, { upsert: true });
    return doc;
  }
  const dbInst = await loadJsonDB();
  const arr = ((dbInst as any)[name] ||= []) as any[];
  const idx = arr.findIndex((d) => d.id === doc.id);
  if (idx >= 0) arr[idx] = doc; else arr.push(doc);
  await saveJsonDB();
  return doc;
}

async function createSession(userId: string): Promise<string> {
  const token = generateToken();
  const doc = { token, userId, createdAt: new Date(), expiresAt: new Date(Date.now() + SESSION_TTL_MS) };
  if (mongo) await mongo.collection("sessions").insertOne(doc);
  else { const dbInst = await loadJsonDB(); (dbInst.sessions ||= []).push(doc); await saveJsonDB(); }
  return token;
}

async function deleteSession(token: string): Promise<void> {
  if (mongo) await mongo.collection("sessions").deleteOne({ token });
  else { const dbInst = await loadJsonDB(); dbInst.sessions = (dbInst.sessions || []).filter((s: any) => s.token !== token); await saveJsonDB(); }
}

async function getSessionUser(token: string): Promise<any | null> {
  let session: any = null;
  if (mongo) session = await mongo.collection("sessions").findOne({ token });
  else { const dbInst = await loadJsonDB(); session = (dbInst.sessions || []).find((s: any) => s.token === token); }
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) { await deleteSession(token); return null; }
  return await findOneByField("users", "id", session.userId);
}

function getToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

function stripSecrets(user: any) {
  if (!user) return user;
  const { passwordHash, pin, ...safe } = user;
  return safe;
}

async function seedAdmin(): Promise<void> {
  const existing = await findOneByField("users", "username", "admin");
  if (existing) {
    console.log("[seed] Admin user already exists (username: admin)");
    return;
  }
  const passwordHash = await hashPassword("#Eightmillionby30$");
  const admin: any = {
    id: "admin-user",
    username: "admin",
    name: "admin",
    email: "admin@elysian.local",
    role: "ADMIN",
    verified: true,
    avatarUrl: "",
    passwordHash,
    pin: "225533",
    subscriptions: [],
    createdAt: new Date().toISOString(),
  };
  await upsertDoc("users", admin);
  console.log("[seed] Admin created — username: admin, PIN: 225533");
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!ADMIN_KEY) return next();
  const key = req.headers["x-admin-key"];
  if (key !== ADMIN_KEY) {
    return res.status(401).json({ error: "Unauthorized — provide X-Admin-Key header" });
  }
  next();
}

async function requireUser(req: Request, res: Response, next: NextFunction) {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: "Authentication required" });
  const user = await getSessionUser(token);
  if (!user) return res.status(401).json({ error: "Session expired or invalid" });
  (req as any).user = user;
  next();
}

function isSafeUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".localhost")) return false;
    if (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) return false;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      const [a, b] = host.split(".").map(Number);
      if (a === 10 || a === 127 || a === 0) return false;
      if (a === 192 && b === 168) return false;
      if (a === 169 && b === 254) return false;
      if (a === 172 && b >= 16 && b <= 31) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function isPlainObject(v: unknown): v is Record<string, any> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // MongoDB Connection Setup
  const uri = process.env.MONGODB_URI;
  if (uri) {
    try {
      const client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
      });
      await client.connect();
      mongo = client.db();
      db = mongo;
      // Initialize GridFS bucket for media/file storage inside MongoDB
      bucket = new GridFSBucket(mongo, { bucketName: 'uploads' });
      console.log("Connected to MongoDB successfully");
    } catch (err) {
      console.error("MongoDB connection error:", err);
    }
  } else {
    console.warn("MONGODB_URI not found. Please add it to your platform secrets. Falling back to local data.json & memory storage.");
  }

  await loadJsonDB();
  await seedAdmin();

  // Middleware to parse JSON payloads with custom 50mb body limit for raw assets
  app.use(express.json({ limit: "50mb", strict: false }));
  app.use((err: any, req: any, res: any, next: any) => {
    if (err instanceof SyntaxError && "body" in err) {
      return res.status(400).json({ error: "Body must be a JSON object" });
    }
    next(err);
  });

  // Multer in-memory storage configuration for handling file uploads
  const upload = multer({ storage: multer.memoryStorage() });

  // --- API Routes ---

  // Healthcheck endpoint for containers and platform ingress
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      mode: mongo ? "mongodb" : "disk",
      mongo: !!mongo,
      gemini: !!GEMINI_API_KEY,
      model: GEMINI_MODEL,
      adminGuard: !!ADMIN_KEY,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
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
    } else if (existsSync(DATA_FILE)) {
      try {
        const data = await fs.readFile(DATA_FILE, "utf-8");
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
  app.post("/api/data", requireAdmin, async (req, res) => {
    if (!isPlainObject(req.body)) {
      return res.status(400).json({ error: "Body must be a JSON object" });
    }
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
        const tmp = DATA_FILE + ".tmp";
        await fs.writeFile(tmp, JSON.stringify(req.body, null, 2), "utf-8");
        await fs.rename(tmp, DATA_FILE);
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
  app.post("/api/scrape-metadata", requireAdmin, async (req: any, res: any) => {
    const { url } = req.body;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "URL is required" });
    }
    if (!isSafeUrl(url)) {
      return res.status(400).json({ error: "URL is not allowed (SSRF guard)" });
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
        model: GEMINI_MODEL,
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
  app.post("/api/upload", requireAdmin, upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    if (bucket) {
      const readablePhotoStream = new Readable();
      readablePhotoStream.push(req.file.buffer);
      readablePhotoStream.push(null);

      const uploadStream = bucket.openUploadStream(req.file.originalname, {
        contentType: req.file.mimetype,
        metadata: {
          size: req.file.size,
          uploadedAt: new Date().toISOString(),
        },
      });
      readablePhotoStream.pipe(uploadStream);

      uploadStream.on("error", () => {
        res.status(500).json({ error: "Upload failed" });
      });

      uploadStream.on("finish", () => {
        const id = uploadStream.id.toString();
        res.json({
          id,
          url: `/api/files/${id}`,
          filename: req.file!.originalname,
          mimetype: req.file!.mimetype,
          size: req.file!.size,
        });
      });
    } else {
      // Disk fallback — write to ./uploads/<id> and serve via /api/files/:id
      await fs.mkdir(UPLOAD_DIR, { recursive: true });
      const id = new ObjectId().toString();
      const filePath = path.join(UPLOAD_DIR, id);
      await fs.writeFile(filePath, req.file.buffer);
      await fs.writeFile(
        filePath + ".meta.json",
        JSON.stringify({
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
        }, null, 2),
      );
      res.json({
        id,
        url: `/api/files/${id}`,
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      });
    }
  });

  /**
   * GET /api/files/:id
   * Streams a stored GridFS media file by its unique MongoDB ObjectId.
   */
  app.get("/api/files/:id", async (req, res) => {
    const id = req.params.id;

    let totalSize = 0;
    let contentType = "application/octet-stream";
    let streamFactory: ((start: number, end: number) => NodeJS.ReadableStream) | null = null;

    try {
      if (bucket && db) {
        let objectId: ObjectId;
        try { objectId = new ObjectId(id); }
        catch { return res.status(400).json({ error: "Invalid file id" }); }

        const files = await db.collection("uploads.files").find({ _id: objectId }).toArray();
        if (!files.length) return res.status(404).json({ error: "File not found" });

        const meta = files[0] as any;
        totalSize = meta.length;
        contentType = meta.contentType || "application/octet-stream";
        streamFactory = (start, end) =>
          bucket!.openDownloadStream(objectId, { start, end: end + 1 });
      } else {
        const filePath = path.join(UPLOAD_DIR, id);
        if (!existsSync(filePath)) return res.status(404).json({ error: "File not found" });

        const stat = await fs.stat(filePath);
        totalSize = stat.size;
        try {
          const meta = JSON.parse(await fs.readFile(filePath + ".meta.json", "utf-8"));
          contentType = meta.mimetype || contentType;
        } catch {}
        streamFactory = (start, end) => createReadStream(filePath, { start, end });
      }
    } catch (e: any) {
      console.error("[files] resolve failed:", e);
      return res.status(500).json({ error: "Failed to open file" });
    }

    if (!streamFactory) return res.status(500).json({ error: "Storage not available" });

    res.setHeader("Content-Type", contentType);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

    const range = req.headers.range;
    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range);
      if (!match) {
        res.setHeader("Content-Range", `bytes */${totalSize}`);
        return res.status(416).end();
      }
      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : totalSize - 1;

      if (start >= totalSize || end >= totalSize || start > end) {
        res.setHeader("Content-Range", `bytes */${totalSize}`);
        return res.status(416).end();
      }

      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${totalSize}`);
      res.setHeader("Content-Length", end - start + 1);

      const stream = streamFactory(start, end);
      stream.on("error", (err) => {
        console.error("[files] stream error:", err);
        if (!res.headersSent) res.status(500).end();
        else res.end();
      });
      stream.pipe(res);
    } else {
      res.setHeader("Content-Length", totalSize);
      const stream = streamFactory(0, totalSize - 1);
      stream.on("error", (err) => {
        console.error("[files] stream error:", err);
        if (!res.headersSent) res.status(500).end();
        else res.end();
      });
      stream.pipe(res);
    }
  });

  // --- Auth routes ---
  app.post("/api/auth/register", async (req, res) => {
    const { name, email, username, password, role } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "email and password required" });
    if (typeof password !== "string" || password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
    const existing = await findOneByField("users", "email", email);
    if (existing) return res.status(409).json({ error: "Email already registered" });
    const passwordHash = await hashPassword(password);
    const user: any = {
      id: generateId(), name: name || email, username: username || email, email,
      role: role || "CONSUMER", verified: false, avatarUrl: "", passwordHash,
      subscriptions: [], createdAt: new Date().toISOString(),
    };
    await upsertDoc("users", user);
    const token = await createSession(user.id);
    res.status(201).json({ user: stripSecrets(user), token });
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password, pin } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "email and password required" });
    let user: any = await findOneByField("users", "email", email);
    if (!user) user = await findOneByField("users", "username", email);
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    const ok = await verifyPassword(password, user.passwordHash || "");
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });
    if (user.role === "ADMIN" && user.pin) {
      if (!pin) return res.status(401).json({ error: "PIN required", requiresPin: true });
      if (String(pin) !== String(user.pin)) return res.status(401).json({ error: "Invalid PIN" });
    }
    const token = await createSession(user.id);
    res.json({ user: stripSecrets(user), token });
  });

  app.get("/api/auth/session", async (req, res) => {
    const token = getToken(req);
    if (!token) return res.json({ user: null });
    const user = await getSessionUser(token);
    res.json({ user: stripSecrets(user) });
  });

  app.post("/api/auth/logout", async (req, res) => {
    const token = getToken(req);
    if (token) await deleteSession(token);
    res.json({ success: true });
  });

  app.put("/api/auth/profile", async (req, res) => {
    const token = getToken(req);
    if (!token) return res.status(401).json({ error: "Not authenticated" });
    const user = await getSessionUser(token);
    if (!user) return res.status(401).json({ error: "Session expired" });
    const updates = req.body || {};
    if (!isPlainObject(updates)) return res.status(400).json({ error: "Body must be a JSON object" });
    delete updates.id; delete updates.role; delete updates.passwordHash; delete updates.pin;
    if (updates.password) { updates.passwordHash = await hashPassword(updates.password); delete updates.password; }
    const merged = { ...user, ...updates };
    await upsertDoc("users", merged);
    res.json({ user: stripSecrets(merged) });
  });

  // Private notifications feed (must be registered before /api/notifications/:id)
  app.get("/api/notifications/mine", requireUser, async (req, res) => {
    const user = (req as any).user;
    try {
      const items = mongo
        ? await mongo.collection("notifications").find({ userId: user.id }).toArray()
        : ((await loadJsonDB() as any).notifications || []).filter((n: any) => n.userId === user.id);
      res.json(items.reverse());
    } catch (e: any) {
      console.error("[notifications] mine:", e);
      res.status(500).json({ error: "Failed to load notifications" });
    }
  });

  // --- Per-entity CRUD routes ---
  const CRUD_COLLECTIONS = [
    "media",
    "talentProfiles",
    "messages",
    "notifications",
    "comments",
    "activityLogs",
  ] as const;

  const OWNER_FIELD: Record<string, string> = {
    media: "userId",
    talentProfiles: "id",
    messages: "senderId",
    notifications: "userId",
    comments: "userId",
    activityLogs: "userId",
  };

  for (const name of CRUD_COLLECTIONS) {
    const router = express.Router();

    // List all (public)
    router.get("/", async (_req, res) => {
      try {
        const items = mongo
          ? await mongo.collection(name).find().toArray()
          : ((await loadJsonDB() as any)[name] || []);
        res.json(items);
      } catch (e: any) {
        console.error(`[${name}] list:`, e);
        res.status(500).json({ error: "Failed to list" });
      }
    });

    // Get one (public)
    router.get("/:id", async (req, res) => {
      try {
        const doc = await findOneByField(name, "id", req.params.id);
        if (!doc) return res.status(404).json({ error: "Not found" });
        res.json(doc);
      } catch (e: any) {
        console.error(`[${name}] get:`, e);
        res.status(500).json({ error: "Failed to fetch" });
      }
    });

    // Create (auth required)
    router.post("/", requireUser, async (req, res) => {
      if (!isPlainObject(req.body)) {
        return res.status(400).json({ error: "Body must be a JSON object" });
      }
      try {
        const user = (req as any).user;
        const ownerField = OWNER_FIELD[name];
        const doc: any = { ...req.body, id: req.body.id || generateId() };

        if (name === "media") {
          doc.userId = user.id;
          doc.creatorName = doc.creatorName || user.name;
          doc.creatorAvatar = doc.creatorAvatar || user.avatarUrl;
          doc.views = doc.views ?? 0;
          doc.uploadedAt = doc.uploadedAt || "Just now";
          doc.likes = doc.likes || [];
          doc.dislikes = doc.dislikes || [];
        } else if (name === "messages") {
          doc.senderId = user.id;
        } else if (name === "comments") {
          doc.userId = user.id;
          doc.userName = user.name;
          doc.userAvatar = user.avatarUrl;
          doc.createdAt = doc.createdAt || new Date().toISOString();
          doc.likes = doc.likes ?? 0;
        } else if (name === "notifications") {
          doc.userId = user.id;
          doc.read = false;
          doc.createdAt = "Just now";
        } else {
          doc[ownerField] = doc[ownerField] || user.id;
        }

        await upsertDoc(name, doc);
        res.status(201).json(doc);
      } catch (e: any) {
        console.error(`[${name}] create:`, e);
        res.status(500).json({ error: "Failed to create" });
      }
    });

    // Update (auth + owner or admin)
    router.put("/:id", requireUser, async (req, res) => {
      if (!isPlainObject(req.body)) {
        return res.status(400).json({ error: "Body must be a JSON object" });
      }
      try {
        const user = (req as any).user;
        const existing: any = await findOneByField(name, "id", req.params.id);
        if (!existing) return res.status(404).json({ error: "Not found" });

        const ownerField = OWNER_FIELD[name];
        const isOwner = existing[ownerField] === user.id;
        const isAdmin = user.role === "ADMIN";
        if (!isOwner && !isAdmin) {
          return res.status(403).json({ error: "Not allowed to modify this record" });
        }

        const safe = { ...req.body };
        delete safe.id;

        if (name === "media") {
          delete safe.userId;
          delete safe.views;
        }

        const merged = { ...existing, ...safe, id: req.params.id };
        await upsertDoc(name, merged);
        res.json(merged);
      } catch (e: any) {
        console.error(`[${name}] update:`, e);
        res.status(500).json({ error: "Failed to update" });
      }
    });

    // Delete (auth + owner or admin)
    router.delete("/:id", requireUser, async (req, res) => {
      try {
        const user = (req as any).user;
        const existing: any = await findOneByField(name, "id", req.params.id);
        if (!existing) return res.status(404).json({ error: "Not found" });

        const ownerField = OWNER_FIELD[name];
        const isOwner = existing[ownerField] === user.id;
        const isAdmin = user.role === "ADMIN";
        if (!isOwner && !isAdmin) {
          return res.status(403).json({ error: "Not allowed to delete this record" });
        }

        if (mongo) {
          await mongo.collection(name).deleteOne({ id: req.params.id });
        } else {
          const db = await loadJsonDB();
          (db as any)[name] = ((db as any)[name] || []).filter((d: any) => d.id !== req.params.id);
          await saveJsonDB();
        }
        res.json({ success: true });
      } catch (e: any) {
        console.error(`[${name}] delete:`, e);
        res.status(500).json({ error: "Failed to delete" });
      }
    });

    app.use(`/api/${name}`, router);
  }

  app.get("/api/users", async (_req, res) => {
    try {
      const users = mongo ? await mongo.collection("users").find().toArray() : ((await loadJsonDB()).users || []);
      res.json(users.map(stripSecrets));
    } catch (e: any) { res.status(500).json({ error: "Failed to list users" }); }
  });

  app.get("/api/users/:id", async (req, res) => {
    const user = await findOneByField("users", "id", req.params.id);
    if (!user) return res.status(404).json({ error: "Not found" });
    res.json(stripSecrets(user));
  });

  // Return 404 for any unhandled API routes before delegating to front-end
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) {
      return res.status(404).json({ error: "Route not found" });
    }
    next();
  });

  // --- Front-end Integration / Asset Serving ---
  // If we are in development, integrate Vite middlewares to hot reload code changes.
  // In production, we serve static compiled files directly from the `/dist` directory.
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use((req, res, next) => {
      if (req.path.startsWith("/api/")) return next();
      vite.middlewares(req, res, next);
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.use((req, res, next) => {
      if (req.path.startsWith("/api/")) {
        return res.status(404).json({ error: "Route not found" });
      }
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    const mongoStatus = mongo ? "MongoDB" : "disk (data.json)";
    const uploads    = mongo ? "GridFS" : UPLOAD_DIR;
    const gemini     = GEMINI_API_KEY ? GEMINI_MODEL : "disabled (no key)";
    const guard      = ADMIN_KEY ? "on" : "off (dev)";

    console.log("");
    console.log("  ⚡ Elysian backend");
    console.log(`  ├─ URL             http://localhost:${PORT}`);
    console.log(`  ├─ Storage         ${mongoStatus}`);
    console.log(`  ├─ Uploads         ${uploads}`);
    console.log(`  ├─ Gemini          ${gemini}`);
    console.log(`  ├─ Admin key guard ${guard}`);
    console.log(`  └─ Admin login     username: admin · PIN required`);
    console.log("");
  });
}

startServer();
