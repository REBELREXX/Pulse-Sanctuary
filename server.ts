/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import dotenv from "dotenv";
import youtube from "youtube-search-api";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // YouTube Search Endpoint
  app.get("/api/youtube/search", async (req, res) => {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: "Missing query" });

    try {
      const results = await youtube.GetListByKeyword(q as string, false, 1);
      const video = results.items[0];
      if (!video) return res.status(404).json({ error: "No video found" });
      
      res.json({ videoId: video.id });
    } catch (error) {
      console.error("YouTube Search Error:", error);
      res.status(500).json({ error: "Search failed" });
    }
  });

  // Spotify Playlist Import (Robust Scraper Mode)
  app.post("/api/spotify/playlist", async (req, res) => {
    const { playlistUrl } = req.body;

    try {
      let targetUrl = playlistUrl;
      
      // 1. Follow redirects for spotify.link short URLs or others
      if (playlistUrl.includes('spotify.link') || playlistUrl.includes('link.spotify.com')) {
        try {
          const redirectRes = await axios.get(playlistUrl, { 
            maxRedirects: 5,
            headers: { 'User-Agent': 'Mozilla/5.0' } 
          });
          targetUrl = redirectRes.request.res.responseUrl || playlistUrl;
        } catch (e) {
          console.warn("Redirect follow failed, continuing with original URL");
        }
      }

      // 2. Flexible ID extraction (Playlists, Albums, Tracks)
      const idMatch = targetUrl.match(/(playlist|album|track)[\/:][a-zA-Z0-9]+(?:\/|:)?([a-zA-Z0-9]+)/i) || 
                      targetUrl.match(/(playlist|album|track)\/([a-zA-Z0-9]+)/i) ||
                      targetUrl.match(/[:/](playlist|album|track)[:/]([a-zA-Z0-9]+)/i);

      if (!idMatch) {
        return res.status(400).json({ error: "Invalid Spotify URL. Please paste a valid Playlist, Album, or Track link." });
      }
      
      const type = idMatch[1].toLowerCase();
      const spotifyId = idMatch[2];
      console.log(`Syncing ${type}: ${spotifyId}`);

      // ... existing sync logic ...

      const axiosConfig = {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Sec-Ch-Ua': '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"macOS"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: 10000,
        maxRedirects: 10
      };

      let rawData: any = null;
      let usedHtml: string = "";

      const urlsToTry = [
        `https://open.spotify.com/embed/${type}/${spotifyId}`,
        `https://open.spotify.com/${type}/${spotifyId}`
      ];

      for (const url of urlsToTry) {
        if (rawData) break;
        try {
          const response = await axios.get(url, axiosConfig);
          const html = response.data;
          if (!html || typeof html !== 'string') continue;
          usedHtml = html;

          // Pattern 1: JSON-LD (Search Engine optimized data)
          const ldMatches = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
          for (const ldMatch of ldMatches) {
            try {
              const ld = JSON.parse(ldMatch[1]);
              const type = ld['@type'];
              if (type === 'MusicPlaylist' || type === 'MusicAlbum' || type === 'MusicRecording') {
                if (type === 'MusicRecording') {
                  rawData = { name: ld.name, tracks: { items: [ld] }, images: [{ url: ld.image || "" }] };
                } else {
                  const items = ld.track || ld.itemListElement || [];
                  rawData = {
                    name: ld.name,
                    images: ld.image ? [{ url: ld.image }] : [],
                    tracks: { items: Array.isArray(items) ? items.map((it: any) => ({ track: it.item || it })) : [] }
                  };
                }
                if (rawData.tracks?.items?.length > 0) {
                  console.log(`Extracted via JSON-LD (${type})`);
                  break;
                }
              }
            } catch(e) {}
          }
          if (rawData) break;

          // Detect Bot Challenges
          if (html.includes("Checking your browser") || html.includes("Just a moment") || html.includes("challenge-running")) {
            console.warn("Bot challenge detected on Spotify fetch.");
            continue;
          }

          // Pattern 2: JSON scripts by ID
          const jsonIds = ['initial-state', 'resource', '__NEXT_DATA__', 'session', 'pwa-data', 'spotify-config'];
          for (const id of jsonIds) {
            const match = html.match(new RegExp(`<script[^>]*id="${id}"[^>]*>([\\s\\S]*?)<\\/script>`));
            if (match) {
              const content = match[1].trim();
              try {
                const parsed = JSON.parse(content);
                if (isValidData(parsed)) {
                  rawData = parsed;
                  console.log(`Found rawData in #${id}`);
                  break;
                }
              } catch (e) {
                try {
                  const decoded = Buffer.from(content, 'base64').toString();
                  const parsed = JSON.parse(decoded);
                  if (isValidData(parsed)) {
                    rawData = parsed;
                    console.log(`Found rawData in #${id} (Base64)`);
                    break;
                  }
                } catch (err) {}
              }
            }
          }

          if (rawData) break;

          // Pattern 3: Embed Tracks Object
          const tracksMatch = html.match(/"tracks":\s*(\{[\s\S]*?"items":\s*\[[\s\S]*?\]\s*\})/);
          if (tracksMatch) {
            try {
              const tracksObj = JSON.parse(tracksMatch[1]);
              rawData = { tracks: tracksObj, name: html.match(/<title>([^<]+)<\/title>/)?.[1] || "Imported Items" };
              console.log("Extracted tracks from embed JSON");
              break;
            } catch(e) {}
          }
        } catch (e: any) {
          console.warn(`Fetch failed for ${url}: ${e.message}`);
        }
      }

      function isValidData(data: any): boolean {
        if (!data) return false;
        // Check for common Spotify data structures
        return !!(data.name || data.entities || data.tracks || data.props || data.playlistData);
      }

      // Check if we still have nothing
      if (!rawData && usedHtml) {
        console.log("No structured JSON found, attempting regex extraction from metadata...");
        const ogTitle = usedHtml.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/)?.[1] ||
                        usedHtml.match(/<meta[^>]*content="([^"]+)"[^>]*property="og:title"/)?.[1];
        const ogImage = usedHtml.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/)?.[1] ||
                        usedHtml.match(/<meta[^>]*content="([^"]+)"[^>]*property="og:image"/)?.[1];
        
        // Extract links
        const tracks = [];
        const trackLinkMatches = [...usedHtml.matchAll(/href="\/track\/([a-zA-Z0-9]+)"[^>]*>([^<]+)/g)];
        for (const match of trackLinkMatches) {
          const [, id, name] = match;
          if (["Home", "Search", "Spotify"].includes(name.trim())) continue;
          tracks.push({
            track: {
              id,
              name: name.trim(),
              artists: [{ name: "Unknown Artist" }],
              album: { name: ogTitle || "Unknown Album", images: [{ url: ogImage }] }
            }
          });
        }

        if (tracks.length > 0) {
          rawData = {
            name: ogTitle || "Imported Playlist",
            images: ogImage ? [{ url: ogImage }] : [],
            tracks: { items: tracks }
          };
          console.log(`Extracted ${tracks.length} tracks via Meta/Link fallback`);
        }
      }

      if (!rawData) {
        return res.status(400).json({ error: "Could not read playlist. Please ensure it is PUBLIC and not a Blend." });
      }

      // Normalization: Find tracks in various possible JSON structures
      function extractTracks(obj: any): any[] {
        if (!obj || typeof obj !== 'object' || obj === null) return [];
        
        // 1. Single track handling
        if (type === 'track') {
          if (obj.name && (obj.artists || obj.byArtist)) return [obj];
          if (obj.track && obj.track.name) return [obj.track];
        }

        // 2. Direct property matches
        const directKeys = ['items', 'tracks', 'trackList', 'playlistData', 'albumData', 'entries', 'content'];
        for (const key of directKeys) {
          if (Array.isArray(obj[key])) {
            const list = obj[key];
            if (list.length > 0 && (list[0].track || list[0].name || list[0].id)) return list;
          }
        }

        // 3. Deep recursive search for any array of objects that look like tracks
        const seen = new WeakSet();
        function deepSearch(current: any): any[] | null {
          if (!current || typeof current !== 'object' || seen.has(current)) return null;
          seen.add(current);

          if (Array.isArray(current)) {
            if (current.length > 0) {
              const first = current[0];
              if (first && typeof first === 'object') {
                // Heuristic: objects with 'name' and 'artists' or a 'track' sub-object are likely tracks
                if ((first.name && (first.artists || first.duration_ms)) || first.track) {
                  return current;
                }
              }
            }
          }

          for (const key in current) {
            if (['images', 'available_markets', 'external_urls', 'owner', 'preview_url', 'user', 'theme', 'config', 'session'].includes(key)) continue;
            try {
              const result = deepSearch(current[key]);
              if (result) return result;
            } catch(e) {}
          }
          return null;
        }

        const found = deepSearch(obj);
        if (found) return found;

        // 4. Special Next.js structure
        return obj.props?.pageProps?.playlistData?.tracks?.items || 
               obj.props?.pageProps?.albumData?.tracks?.items || [];
      }

      let tracksData = extractTracks(rawData);

      // 6. Brute-force fallback: Multi-layer Regex the raw HTML
      if (tracksData.length === 0 && usedHtml) {
        console.log("JSON/Direct sync failed, trying intensive scrape...");
        
        const possiblePatterns = [
           /{"track":{"name":"([^"]+)"[^{}]*,"uri":"spotify:track:([a-zA-Z0-9]+)"[^{}]*,"artists":\[{"name":"([^"]+)"/g,
           /"name":"([^"]+)","uri":"spotify:track:([a-zA-Z0-9]+)","artists":\[{"name":"([^"]+)"/g,
           /href="\/track\/([a-zA-Z0-9]+)"[^>]*>([^<]+)/g,
           /"name":"([^"]+)","id":"([a-zA-Z0-9]+)","type":"track"/g,
           /"name":"([^"]+)","id":"([a-zA-Z0-9]{22})"/g
        ];

        const allCapturedTracks = new Map();

        for (const pattern of possiblePatterns) {
           const matches = [...usedHtml.matchAll(pattern)];
           for (const m of matches) {
              const id = m[2] || m[1];
              const name = m[1] || m[2];
              if (id && name && !allCapturedTracks.has(id)) {
                 allCapturedTracks.set(id, { track: { name, id, artists: [{ name: m[3] || "Various Artists" }] } });
              }
           }
           if (allCapturedTracks.size > 5) break; 
        }
        
        tracksData = Array.from(allCapturedTracks.values());
        console.log(`Deep scrape found ${tracksData.length} potential tracks`);
      }

      // Meta Tag Special Handling for single tracks
      if (tracksData.length === 0 && type === 'track' && usedHtml) {
        const ogTitle = usedHtml.match(/<meta property="og:title" content="([^"]+)"/)?.[1];
        const ogDesc = usedHtml.match(/<meta property="og:description" content="([^"]+)"/)?.[1];
        if (ogTitle) {
          tracksData = [{ track: { name: ogTitle, artists: [{ name: ogDesc?.split(' · ')[0] || "Unknown" }] } }];
        }
      }
      const playlistName = rawData.name || rawData.playlistData?.name || rawData.props?.pageProps?.playlistData?.name || "Imported Collection";
      const rawImages = rawData.images || rawData.playlistData?.images || rawData.props?.pageProps?.playlistData?.images || [];
      const playlistImage = Array.isArray(rawImages) ? (rawImages[0]?.url || "") : "";

      if (tracksData.length === 0) {
        return res.status(400).json({ 
          error: "No tracks found. This content might be private, empty, or currently restricted by Spotify's web player." 
        });
      }

      console.log(`Syncing ${tracksData.length} tracks from "${playlistName}"...`);
      
      // Limit to 50 tracks to keep it snappy
      const itemsToEnrich = tracksData.slice(0, 50);
      
      const enrichedTracks = [];
      const batchSize = 4; // Smaller batches to avoid rate limits
      for (let i = 0; i < itemsToEnrich.length; i += batchSize) {
        const batch = itemsToEnrich.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(async (item) => {
          const track = item.track || item.item?.data || item;
          if (!track || (!track.name && !item.name)) return null;

          const name = track.name || item.name;
          const artist = track.artists?.map((a: any) => a.name || a.profile?.name).join(", ") || "Various Artists";
          const albumName = track.album?.name || playlistName || "Unknown Album";
          const coverArt = track.album?.images?.[0]?.url || playlistImage;

          let videoId = null;
          try {
            // "Different way" to fetch: try different search terms if first fails
            const searchQueries = [
              `${name} ${artist} audio`,
              `${name} ${artist} official`,
              `${name} music video`
            ];

            for (const query of searchQueries) {
              try {
                const searchResults = await youtube.GetListByKeyword(query, false, 1);
                if (searchResults.items?.[0]?.id) {
                  videoId = searchResults.items[0].id;
                  break;
                }
              } catch(e) {}
            }
          } catch (e) {
            console.error(`YouTube search failed for ${name}`);
          }

          return {
            id: track.id || `sync-${Math.random().toString(36).substring(2, 11)}`,
            name,
            artist,
            album: albumName,
            duration: track.duration_ms ? Math.floor(track.duration_ms / 1000) : 0,
            image: coverArt,
            youtubeId: videoId,
            fileUrl: ""
          };
        }));
        enrichedTracks.push(...batchResults.filter(Boolean));
      }

      res.json({
        name: playlistName,
        coverArt: playlistImage,
        tracks: enrichedTracks,
        totalFound: tracksData.length,
        importedCount: enrichedTracks.length
      });
    } catch (error: any) {
      console.error("Spotify Sync Error:", error.message);
      res.status(500).json({ error: error.message || "Failed to sync. Ensure the content is Public and try again." });
    }
  });

  // Vite middle-ware
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
