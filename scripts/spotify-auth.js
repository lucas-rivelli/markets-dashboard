#!/usr/bin/env node
/**
 * One-time Spotify OAuth — prints a refresh token for Vercel env vars.
 *
 * 1. Create an app at https://developer.spotify.com/dashboard
 * 2. Set Redirect URI to: http://127.0.0.1:8888/callback
 * 3. Run: SPOTIFY_CLIENT_ID=... SPOTIFY_CLIENT_SECRET=... node scripts/spotify-auth.js
 * 4. Add SPOTIFY_REFRESH_TOKEN to Vercel environment variables
 */

const http = require("http");
const { URL } = require("url");

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT = "http://127.0.0.1:8888/callback";
const SCOPES = ["user-library-read"].join(" ");

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET first.");
  process.exit(1);
}

const authUrl =
  "https://accounts.spotify.com/authorize?" +
  new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT,
    scope: SCOPES,
  });

console.log("\nOpen this URL in your browser:\n");
console.log(authUrl);
console.log("\nWaiting for callback on http://127.0.0.1:8888 …\n");

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:8888");
  if (url.pathname !== "/callback") {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error || !code) {
    res.writeHead(400);
    res.end("Authorization failed. Check the terminal.");
    console.error("Auth error:", error || "no code");
    server.close();
    process.exit(1);
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT,
  });

  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
    },
    body,
  });

  const data = await tokenRes.json();

  res.writeHead(200, { "Content-Type": "text/html" });
  res.end("<h1>Spotify connected</h1><p>You can close this tab.</p>");

  console.log("\nAdd these to Vercel → Settings → Environment Variables:\n");
  console.log(`SPOTIFY_CLIENT_ID=${CLIENT_ID}`);
  console.log(`SPOTIFY_CLIENT_SECRET=${CLIENT_SECRET}`);
  console.log(`SPOTIFY_REFRESH_TOKEN=${data.refresh_token}`);
  console.log("\nThen redeploy.\n");

  server.close();
  process.exit(0);
});

server.listen(8888);
