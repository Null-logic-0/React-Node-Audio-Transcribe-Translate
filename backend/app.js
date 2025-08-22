// backend/app.js
import express from "express";
import multer from "multer";
import fs from "fs";
import cors from "cors";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import OpenAI from "openai";
import dotenv from "dotenv";
import { execSync } from "child_process";

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = 3000;

// ---- CORS ----
app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "OPTIONS"],
  }),
);

// ---- Multer setup (accept all audio) ----
import path from "path";

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    // Keep original extension
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("audio/")) cb(null, true);
    else cb(new Error("Only audio files allowed"));
  },
});

// ---- OpenAI client ----
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---- Test route for Postman ----
app.post("/upload-test", upload.single("audio"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  res.json({ filename: req.file.originalname, size: req.file.size });
});

// ---- Real upload + transcription + translation ----
app.post("/api/upload", upload.single("audio"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const originalPath = join(__dirname, req.file.path);
  const convertedPath = originalPath.replace(/\.\w+$/, "_converted.wav");

  try {
    // Convert to Whisper-compatible WAV (16kHz, mono)
    execSync(
      `ffmpeg -y -i "${originalPath}" -ar 16000 -ac 1 "${convertedPath}"`,
    );

    // Transcribe
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(convertedPath),
      model: "whisper-1",
    });
    const englishText = transcription.text;

    // Translate
    const translation = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Translate the following English text into Spanish.",
        },
        { role: "user", content: englishText },
      ],
    });
    const spanishText = translation.choices[0].message.content;

    // Cleanup
    fs.unlinkSync(originalPath);
    fs.unlinkSync(convertedPath);

    res.json({ english: englishText, spanish: spanishText });
  } catch (err) {
    console.error("Upload error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---- Multer/general error handler ----
app.use((err, req, res, next) => {
  console.error("Error:", err.message);
  if (err instanceof multer.MulterError)
    return res.status(400).json({ error: err.message });
  res.status(500).json({ error: err.message });
});

// ---- Start server ----
app.listen(port, () =>
  console.log(`Server running on http://localhost:${port}`),
);
