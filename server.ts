import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import * as admin from "firebase-admin";
import fs from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
if (fs.existsSync(firebaseConfigPath)) {
  const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const db = admin.firestore();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Helper to get/refresh tokens
  async function getStoredToken(userId: string, provider: 'spotify' | 'youtube') {
    const tokenDoc = await db.collection('tokens').doc(userId).collection('providers').doc(provider).get();
    if (!tokenDoc.exists) return null;

    const data = tokenDoc.data()!;
    if (Date.now() < data.expiresAt) {
      return data.accessToken;
    }

    // Refresh token
    if (provider === 'spotify') {
      const response = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${process.env.VITE_SPOTIFY_CLIENT_ID}:${process.env.VITE_SPOTIFY_CLIENT_SECRET}`).toString("base64")}`,
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: data.refreshToken,
        }),
      });

      const newData = await response.json();
      if (newData.error) throw new Error(newData.error_description);

      const accessToken = newData.access_token;
      const expiresAt = Date.now() + newData.expires_in * 1000;

      await tokenDoc.ref.update({
        accessToken,
        expiresAt,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return accessToken;
    } else if (provider === 'youtube') {
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          refresh_token: data.refreshToken,
          grant_type: "refresh_token",
        }),
      });

      const newData = await response.json();
      if (newData.error) throw new Error(newData.error_description);

      const accessToken = newData.access_token;
      const expiresAt = Date.now() + newData.expires_in * 1000;

      await tokenDoc.ref.update({
        accessToken,
        expiresAt,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return accessToken;
    }

    return null;
  }

  // Spotify Auth
  app.get("/api/auth/spotify/url", (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "userId required" });

    const client_id = process.env.VITE_SPOTIFY_CLIENT_ID;
    const redirect_uri = `${process.env.APP_URL}/auth/spotify/callback`;
    const scope = "user-read-private user-read-email user-modify-playback-state user-read-playback-state streaming";
    
    const params = new URLSearchParams({
      response_type: "code",
      client_id: client_id || "",
      scope: scope,
      redirect_uri: redirect_uri,
      state: userId as string,
    });

    res.json({ url: `https://accounts.spotify.com/authorize?${params.toString()}` });
  });

  app.get("/auth/spotify/callback", async (req, res) => {
    const { code, state: userId } = req.query;
    if (!code || !userId) return res.status(400).send("Missing code or state");

    try {
      const response = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${process.env.VITE_SPOTIFY_CLIENT_ID}:${process.env.VITE_SPOTIFY_CLIENT_SECRET}`).toString("base64")}`,
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: code as string,
          redirect_uri: `${process.env.APP_URL}/auth/spotify/callback`,
        }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error_description);

      await db.collection('tokens').doc(userId as string).collection('providers').doc('spotify').set({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + data.expires_in * 1000,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'SPOTIFY_AUTH_SUCCESS' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Spotify connected! This window should close automatically.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Spotify callback error:", error);
      res.status(500).send("Failed to connect Spotify");
    }
  });

  // YouTube Auth
  app.get("/api/auth/youtube/url", (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "userId required" });

    const client_id = process.env.GOOGLE_CLIENT_ID;
    const redirect_uri = `${process.env.APP_URL}/auth/youtube/callback`;
    const scope = "https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.force-ssl";
    
    const params = new URLSearchParams({
      client_id: client_id || "",
      redirect_uri: redirect_uri,
      response_type: "code",
      scope: scope,
      access_type: "offline",
      prompt: "consent",
      state: userId as string,
    });

    res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
  });

  app.get("/auth/youtube/callback", async (req, res) => {
    const { code, state: userId } = req.query;
    if (!code || !userId) return res.status(400).send("Missing code or state");

    try {
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: code as string,
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          redirect_uri: `${process.env.APP_URL}/auth/youtube/callback`,
          grant_type: "authorization_code",
        }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error_description);

      await db.collection('tokens').doc(userId as string).collection('providers').doc('youtube').set({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + data.expires_in * 1000,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'YOUTUBE_AUTH_SUCCESS' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>YouTube connected! This window should close automatically.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("YouTube callback error:", error);
      res.status(500).send("Failed to connect YouTube");
    }
  });

  // Spotify Search Endpoint (Updated to use user token if available)
  app.get("/api/spotify/search", async (req, res) => {
    const { q, userId } = req.query;
    if (!q) return res.status(400).json({ error: "Query required" });

    try {
      let token;
      if (userId) {
        token = await getStoredToken(userId as string, 'spotify');
      }
      
      // Fallback to client credentials if no user token
      if (!token) {
        // ... existing client credentials logic ...
        const client_id = process.env.VITE_SPOTIFY_CLIENT_ID;
        const client_secret = process.env.VITE_SPOTIFY_CLIENT_SECRET;
        const authRes = await fetch("https://accounts.spotify.com/api/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(`${client_id}:${client_secret}`).toString("base64")}`,
          },
          body: "grant_type=client_credentials",
        });
        const authData = await authRes.json();
        token = authData.access_token;
      }

      const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(q as string)}&type=track&limit=10`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      const tracks = data.tracks.items.map((item: any) => ({
        id: item.id,
        title: item.name,
        artist: item.artists.map((a: any) => a.name).join(", "),
        thumbnail: item.album.images[0]?.url,
        source: "spotify",
        url: item.preview_url,
      }));

      res.json({ tracks });
    } catch (error) {
      console.error("Spotify search error:", error);
      res.status(500).json({ error: "Failed to search Spotify" });
    }
  });

  // YouTube Search Endpoint (Updated to use user token if available)
  app.get("/api/youtube/search", async (req, res) => {
    const { q, userId } = req.query;
    if (!q) return res.status(400).json({ error: "Query required" });

    try {
      let token;
      if (userId) {
        token = await getStoredToken(userId as string, 'youtube');
      }

      let url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(q as string)}&type=video&maxResults=10`;
      const headers: any = {};

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      } else {
        url += `&key=${process.env.YOUTUBE_API_KEY}`;
      }

      const response = await fetch(url, { headers });
      const data = await response.json();

      const tracks = data.items.map((item: any) => ({
        id: item.id.videoId,
        title: item.snippet.title,
        artist: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails.default?.url,
        source: "youtube",
        url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      }));

      res.json({ tracks });
    } catch (error) {
      console.error("YouTube search error:", error);
      res.status(500).json({ error: "Failed to search YouTube" });
    }
  });

  // Check connection status
  app.get("/api/auth/status", async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "userId required" });

    const spotify = await db.collection('tokens').doc(userId as string).collection('providers').doc('spotify').get();
    const youtube = await db.collection('tokens').doc(userId as string).collection('providers').doc('youtube').get();

    res.json({
      spotify: spotify.exists,
      youtube: youtube.exists,
    });
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
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
