import express from "express";
import path from "path";
import fs from "fs-extra";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import AdmZip from "adm-zip";
import { GoogleGenAI } from "@google/genai";

// System diagnostic logs capture to easily diagnose Stremio fetch/cors errors remotely
const syslogs: string[] = [];
const originalLog = console.log;
const originalError = console.error;

console.log = (...args: any[]) => {
  const line = args.map(arg => typeof arg === "object" ? JSON.stringify(arg) : arg).join(" ");
  syslogs.push(`[LOG] ${new Date().toISOString()} - ${line}`);
  if (syslogs.length > 500) syslogs.shift();
  originalLog(...args);
};

console.error = (...args: any[]) => {
  const line = args.map(arg => typeof arg === "object" ? JSON.stringify(arg) : arg).join(" ");
  syslogs.push(`[ERROR] ${new Date().toISOString()} - ${line}`);
  if (syslogs.length > 500) syslogs.shift();
  originalError(...args);
};

// In-memory cache for translated subtitles to prevent duplicate API requests
const subtitleCache: Record<string, string> = {};

// Default Stremio Manifest
const baseManifest = {
  id: "com.seranddex.subtitles",
  version: "1.1.0",
  name: "SER AND DEX SUBTITLE",
  description: "Professional English to Arabic subtitle translation and synchronization.",
  types: ["movie", "series"],
  catalogs: [],
  resources: ["subtitles"],
  idPrefixes: ["tt"]
};

// Helper to decode Base64 Config Safely
function decodeConfig(encoded: string) {
  if (!encoded) {
    return {
      subdlKey: "",
      subsourceKey: "",
      geminiKey: "",
      openSubtitles: false,
      sourceLang: "en",
      targetLang: "ar"
    };
  }
  try {
    // Restore Base64 URL-safe characters and strip padding characters securely
    let base64 = encoded.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
    // Standard Base64 requires length of raw digits to be a multiple of 4
    const pad = base64.length % 4;
    if (pad === 2) {
      base64 += "==";
    } else if (pad === 3) {
      base64 += "=";
    }
    const jsonStr = Buffer.from(base64, "base64").toString("utf-8");
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("Failed to decode config string:", encoded, e);
    return {
      subdlKey: "",
      subsourceKey: "",
      geminiKey: "",
      openSubtitles: false,
      sourceLang: "en",
      targetLang: "ar"
    };
  }
}

// Download and extract raw SRT subtitle, automatically unzipping if required
async function getSrtContent(url: string): Promise<string> {
  try {
    console.log(`Downloading subtitle from SubDL URL: ${url}`);
    const response = await axios.get(url, { responseType: "arraybuffer", timeout: 10000 });
    const buffer = Buffer.from(response.data);

    // Detect if buffer is a zip file (magic bytes 'PK\x03\x04')
    if (buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
      console.log("ZIP archive detected, extracting srt file...");
      const zip = new AdmZip(buffer);
      const zipEntries = zip.getEntries();
      
      // Look for the first file ending with .srt inside the ZIP archive
      const srtEntry = zipEntries.find((entry) => 
        entry.entryName.toLowerCase().endsWith(".srt") && 
        !entry.isDirectory
      );
      
      if (srtEntry) {
        console.log(`Found subtitle entry: ${srtEntry.entryName}`);
        return srtEntry.getData().toString("utf-8");
      }
      
      // Fallback to any subtitle file found
      const fallbackEntry = zipEntries.find((entry) => 
        (entry.entryName.toLowerCase().endsWith(".vtt") || entry.entryName.toLowerCase().endsWith(".ass")) && 
        !entry.isDirectory
      );
      if (fallbackEntry) {
        console.log(`Found fallback subtitle entry: ${fallbackEntry.entryName}`);
        return fallbackEntry.getData().toString("utf-8");
      }
    }

    // Try standard string decode (defaulting to UTF-8)
    const decoder = new TextDecoder("utf-8");
    return decoder.decode(buffer);
  } catch (err: any) {
    console.error("Error retrieving subtitle content:", err.message);
    throw err;
  }
}

// Translate SRT subtitles utilizing Google AI Studio (Gemini)
async function translateSRT(srtContent: string, geminiKey: string): Promise<string> {
  if (!geminiKey) return srtContent;
  
  try {
    console.log("Starting Google AI Gemini translation phase...");
    // Lazy initialize Google GenAI SDK
    const ai = new GoogleGenAI({ apiKey: geminiKey });
    
    const prompt = `
You are an expert bilingual subtitle translator. Translate the following SRT subtitle content into high-quality, professional, and natural Arabic.
Ensure you correct any grammar, spelling, or local phrasing mistakes. 

IMPORTANT RULES:
1. Preserve the exact SRT structure, index numbers, and timecode lines (e.g., "00:01:20,000 --> 00:01:23,000") UNTOUCHED. Do not translate or alter them.
2. Only translate the English text belonging to the subtitle cues into beautiful Arabic.
3. Keep the SRT numbering and timing in sync.

SRT Subtitle Content:
${srtContent}
`;

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: prompt,
    });

    const translatedText = response.text || "";
    if (translatedText.trim()) {
      console.log("Translation completed successfully.");
      return translatedText;
    }
  } catch (error: any) {
    console.error("Gemini Translation Error:", error.message || error);
  }
  return srtContent;
}

// Timing synchronization helper
function shiftSRTTiming(srtContent: string, offsetMs: number): string {
  if (offsetMs === 0) return srtContent;
  const timeRegex = /(\d{2}):(\d{2}):(\d{2}),(\d{3})/g;
  
  return srtContent.replace(timeRegex, (match, hrs, mins, secs, ms) => {
    let totalMs = parseInt(hrs, 10) * 3600000 + 
                  parseInt(mins, 10) * 60000 + 
                  parseInt(secs, 10) * 1000 + 
                  parseInt(ms, 10);
    
    totalMs += offsetMs;
    if (totalMs < 0) totalMs = 0;
    
    const newHrs = Math.floor(totalMs / 3600000).toString().padStart(2, "0");
    totalMs %= 3600000;
    const newMins = Math.floor(totalMs / 60000).toString().padStart(2, "0");
    totalMs %= 60000;
    const newSecs = Math.floor(totalMs / 1000).toString().padStart(2, "0");
    const newMs = (totalMs % 1000).toString().padStart(3, "0");
    
    return `${newHrs}:${newMins}:${newSecs},${newMs}`;
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Essential CORS settings to prevent Stremio Addon endless loading or CORS failures in all clients
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Origin, X-Requested-With, Accept");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // System logs viewer endpoint
  app.get("/api/syslogs", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.send(syslogs.join("\n"));
  });

  // Default manifest - upgraded to support optional query parameter config (?config=...) Safely!
  app.get("/manifest.json", (req, res) => {
    const configEncoded = (req.query.config as string) || "";
    const config = decodeConfig(configEncoded);
    const userAgent = req.get("user-agent") || "unknown";
    const remoteIp = req.ip || req.headers["x-forwarded-for"] || "unknown";
    console.log(`[MANIFEST] /manifest.json requested with config: "${configEncoded}" from IP: ${remoteIp} (UA: ${userAgent})`);
    
    // Clean string of any slashes or special characters for valid Stremio ID specs
    const safeSuf = configEncoded.replace(/[^a-zA-Z0-9]/g, "").substring(0, 12).toLowerCase();
    
    const sourceTag = (config.sourceLang || "en").toUpperCase();
    const targetTag = (config.targetLang || "ar").toUpperCase();

    const manifest = {
      ...baseManifest,
      id: `com.seranddex.subtitles.${safeSuf || "default"}`,
      name: "SER AND DEX SUBTITLE",
      description: `Professional ${sourceTag} to ${targetTag} subtitle translation and synchronization.`
    };
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.json(manifest);
  });

  // Configured manifest (remains active for backwards compatibility)
  app.get("/c/:config/manifest.json", (req, res) => {
    const configEncoded = req.params.config || "";
    const config = decodeConfig(configEncoded);
    const userAgent = req.get("user-agent") || "unknown";
    const remoteIp = req.ip || req.headers["x-forwarded-for"] || "unknown";
    console.log(`[MANIFEST] /c/${configEncoded}/manifest.json requested from IP: ${remoteIp} (UA: ${userAgent})`);
    
    // Clean string of any slashes or special characters for valid Stremio ID specs
    const safeSuf = configEncoded.replace(/[^a-zA-Z0-9]/g, "").substring(0, 12).toLowerCase();
    
    const sourceTag = (config.sourceLang || "en").toUpperCase();
    const targetTag = (config.targetLang || "ar").toUpperCase();

    const manifest = {
      ...baseManifest,
      id: `com.seranddex.subtitles.${safeSuf || "default"}`,
      name: "SER AND DEX SUBTITLE",
      description: `Professional ${sourceTag} to ${targetTag} subtitle translation and synchronization.`
    };
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.json(manifest);
  });

  // Unified controller to handle various structures of Stremio requests seamlessly without 404
  const handleSubtitlesUnified = async (req: express.Request, res: express.Response) => {
    try {
      const configEncoded = req.params.config || req.body?.config || (req.query?.config as string) || "";
      const config = decodeConfig(configEncoded);
      
      const type = req.params.type || req.body?.type || (req.query?.type as string) || "";
      
      // Try express route param ID first
      let rawId = req.params.id || req.body?.id || (req.query?.id as string) || "";
      let extra = "";

      // Fallback: search wildcard remainder path if explicit param not assigned
      if (!rawId) {
        const remainingPath = req.params[0] || "";
        if (!remainingPath) {
          return res.json({ subtitles: [] });
        }
        const cleanPath = remainingPath.replace(/\.json$/, "");
        const segments = cleanPath.split("/").filter(Boolean);
        if (segments.length > 0) {
          rawId = segments[0];
          extra = segments.slice(1).join("/");
        }
      } else {
        // Strip out the static extension '.json' if matched inside route param id
        rawId = rawId.replace(/\.json$/, "");
      }

      if (!rawId) {
        return res.json({ subtitles: [] });
      }

      // CRITICAL BUGFIX: decode URI completely (converts %3A to :)
      const decodedId = decodeURIComponent(rawId);
      
      // Parse IMDB ID, Season & Episode from decoded string
      const parts = decodedId.split(":");
      const imdbId = parts[0];
      const season = parts[1] || "";
      const episode = parts[2] || "";

      console.log(`[Stremio Addon Query] unified request details:
        - Configured config string: ${configEncoded ? "Yes" : "No"}
        - Content Type (movie/show): ${type}
        - Decoded ID: ${decodedId}
        - IMDB ID: ${imdbId}
        - Season: ${season}
        - Episode: ${episode}
        - Extra Meta: ${extra}`);

      const resultSubtitles: any[] = [];

      // Only search SubDL if key exists
      if (config.subdlKey) {
        const params: Record<string, any> = {
          api_key: config.subdlKey,
          imdb_id: imdbId,
          languages: config.targetLang || "ar",
        };

        if (season) params.season = season;
        if (episode) params.episode = episode;
        
        if (type === "movie") {
          params.film_type = "movie";
        } else {
          params.film_type = "show";
        }

        try {
          const subdlResponse = await axios.get("https://api.subdl.com/api/v1/subtitles", {
            params,
            timeout: 6000
          });

          if (subdlResponse.data && subdlResponse.data.status && subdlResponse.data.subtitles?.length > 0) {
            // Extract up to 3 options to display inside Stremio
            const rawSubtitles = subdlResponse.data.subtitles.slice(0, 3);
            
            rawSubtitles.forEach((sub: any, i: number) => {
              const downloadUrl = sub.url || sub.link;
              if (downloadUrl) {
                const cacheId = uuidv4();
                subtitleCache[cacheId] = downloadUrl;

                const sourceTag = (config.sourceLang || "en").toUpperCase();
                const targetTag = (config.targetLang || "ar").toUpperCase();

                resultSubtitles.push({
                  id: cacheId,
                  lang: config.targetLang === "ar" ? "ara" : "eng",
                  url: `https://${req.get("host")}/c/${configEncoded}/srt/${cacheId}`,
                  title: `[SER-DEX] AI-Translate (${sourceTag}➔${targetTag}) #${i + 1} - ${sub.release_name || "Synced"}`
                });
              }
            });
          }
        } catch (subdlErr: any) {
          console.error("[SubDL API Query Error]:", subdlErr.message);
        }
      }

      // If no subtitles were returned (or API was inactive/errored), provide placeholder on-screen instructions rather than spinning or empty space
      if (resultSubtitles.length === 0) {
        const sourceTag = (config.sourceLang || "en").toUpperCase();
        const targetTag = (config.targetLang || "ar").toUpperCase();
        resultSubtitles.push({
          id: "tutorial_helper",
          lang: config.targetLang === "ar" ? "ara" : "eng",
          url: `https://${req.get("host")}/c/${configEncoded}/helper-srt`,
          title: `⚠️ [SER-DEX] ${config.subdlKey ? "No subtitles found (لم يتم العثور على ترجمة)" : "Configure Addon (يرجى ضبط الترجمة)"}`
        });
      }

      return res.json({ subtitles: resultSubtitles });
    } catch (e: any) {
      console.error("[Stremio Controller Error]:", e.message);
      // Ensure we fail cleanly with an empty array so Stremio client loads successfully quickly
      return res.json({ subtitles: [] });
    }
  };

  // Structured explicit routes aligned precisely with Stremio Addon Protocol spec
  app.get("/c/:config/subtitles/:type/:id.json", handleSubtitlesUnified);
  app.get("/c/:config/subtitles/:type/:id/:extra.json", handleSubtitlesUnified);
  app.get("/subtitles/:type/:id.json", handleSubtitlesUnified);
  app.get("/subtitles/:type/:id/:extra.json", handleSubtitlesUnified);

  // Safe Wildcard routes capture any segment after /subtitles/:type/ (e.g. tt1234.json or tt1234/extra.json)
  app.get("/c/:config/subtitles/:type/*", handleSubtitlesUnified);
  app.get("/subtitles/:type/*", handleSubtitlesUnified);

  // Support POST subtitle query routing as explicitly requested
  app.post("/c/:config/subtitles", express.json(), express.urlencoded({ extended: true }), handleSubtitlesUnified);

  // SRT Serve & Real-Time translation endpoint
  const handleSrtUnified = async (req: express.Request, res: express.Response) => {
    const cacheId = req.params.id;
    const configEncoded = req.params.config || (req.query.config as string) || "";
    const config = decodeConfig(configEncoded);
    
    const sourceUrl = subtitleCache[cacheId];
    if (!sourceUrl) {
      return res.status(404).send("Subtitle not found or expired.");
    }

    try {
      // 1. Download and automatically extract zip subtitle archive
      let subtitleContent = await getSrtContent(sourceUrl);

      // 2. Perform intelligent AI translation if Gemini Key is active
      if (config.geminiKey) {
        // Translate content via Google AI Studio
        const translated = await translateSRT(subtitleContent, config.geminiKey);
        
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        return res.send(translated);
      }

      // Fallback: return raw subtitle
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return res.send(subtitleContent);
    } catch (err: any) {
      console.error("Error generating translated SRT:", err.message);
      res.status(500).send("Translation/Sync process failed.");
    }
  };

  app.get("/srt/:id", handleSrtUnified);
  app.get("/c/:config/srt/:id", handleSrtUnified);

  // Helpful on-screen guidelines inside player when addon needs setup or has empty results
  const handleHelperSrtUnified = (req: express.Request, res: express.Response) => {
    const configEncoded = req.params.config || (req.query.config as string) || "";
    const config = decodeConfig(configEncoded);
    
    let srtText = "";
    if (!config.subdlKey) {
      srtText = `1
00:00:01,000 --> 00:00:15,000
⚠️ يرجى ضبط إعدادات بالإضافة أولاً ⚠️
لم تقم بإدخال مفتاح SubDL بموقع الإضافة.

2
00:00:16,000 --> 00:00:30,000
الرجاء الانتقال لصفحة الإعدادات الخاصة بـ SER & DEX
وأدخل مفاتيح API الخاصة بك ثم اضغط حفظ وتثبيت.

3
00:00:31,000 --> 00:00:45,000
Please insert your SubDL and Google AI Keys
in the configuration page to activate automatic subtitles.
`;
    } else {
      srtText = `1
00:00:01,000 --> 00:00:15,000
❌ لم يتم العثور على ترجمات لهذا المقطع من SubDL ❌
تأكد من صحة معرف المقطع أو دقة البيانات.

2
00:00:16,000 --> 00:00:30,000
No subtitles available for this feed on SubDL.
Please try another source or verify your key.
`;
    }
    
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.send(srtText);
  };

  app.get("/helper-srt", handleHelperSrtUnified);
  app.get("/c/:config/helper-srt", handleHelperSrtUnified);

  // Server UI (Vite or static server depending on mode)
  const isProd = process.env.NODE_ENV === "production" || fs.existsSync(path.join(process.cwd(), "dist/index.html"));
  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SER AND DEX SUBTITLE Server operating successfully on port ${PORT}`);
  });
}

startServer();
