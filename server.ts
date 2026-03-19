import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  let spotifyAccessToken = "";
  let tokenExpiry = 0;

  async function getSpotifyToken() {
    if (spotifyAccessToken && Date.now() < tokenExpiry) {
      return spotifyAccessToken;
    }

    const client_id = process.env.VITE_SPOTIFY_CLIENT_ID;
    const client_secret = process.env.VITE_SPOTIFY_CLIENT_SECRET;

    if (!client_id || !client_secret) {
      throw new Error("Spotify credentials missing");
    }

    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${client_id}:${client_secret}`).toString("base64")}`,
      },
      body: "grant_type=client_credentials",
    });

    const data = await response.json();
    spotifyAccessToken = data.access_token;
    tokenExpiry = Date.now() + data.expires_in * 1000;
    return spotifyAccessToken;
  }

  // Spotify Search Endpoint
  app.get("/api/spotify/search", async (req, res) => {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: "Query required" });

    try {
      const token = await getSpotifyToken();
      const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(q as string)}&type=track&limit=10`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      const tracks = data.tracks.items.map((item: any) => ({
        id: item.id,
        title: item.name,
        artist: item.artists.map((a: any) => a.name).join(", "),
        thumbnail: item.album.images[0]?.url,
        source: "spotify",
        url: item.preview_url, // Note: Preview URLs are often null for many tracks now
      }));

      res.json({ tracks });
    } catch (error) {
      console.error("Spotify search error:", error);
      res.status(500).json({ error: "Failed to search Spotify" });
    }
  });

  // Spotify Auth Endpoints
  app.get("/api/auth/spotify/url", (req, res) => {
    const client_id = process.env.VITE_SPOTIFY_CLIENT_ID;
    const redirect_uri = `${process.env.APP_URL}/auth/spotify/callback`;
    const scope = "user-read-private user-read-email user-modify-playback-state user-read-playback-state streaming";
    
    const params = new URLSearchParams({
      response_type: "code",
      client_id: client_id || "",
      scope: scope,
      redirect_uri: redirect_uri,
    });

    res.json({ url: `https://accounts.spotify.com/authorize?${params.toString()}` });
  });

  app.get("/auth/spotify/callback", (req, res) => {
    const { code } = req.query;
    // In a real app, we'd exchange the code for tokens here.
    // For this demo, we'll just pass the code back to the client.
    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'SPOTIFY_AUTH_SUCCESS', code: '${code}' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. This window should close automatically.</p>
        </body>
      </html>
    `);
  });

  // YouTube Search Endpoint
  app.get("/api/youtube/search", async (req, res) => {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: "Query required" });

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "YouTube API Key missing" });

    try {
      const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(q as string)}&type=video&maxResults=10&key=${apiKey}`);
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
