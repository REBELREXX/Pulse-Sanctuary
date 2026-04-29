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
      // Flexible ID extraction
      const playlistIdMatch = playlistUrl.match(/playlist\/([a-zA-Z0-9]+)/) || playlistUrl.match(/[:/][pP]laylist[:/]([a-zA-Z0-9]+)/);
      if (!playlistIdMatch) {
        return res.status(400).json({ error: "Invalid Spotify playlist URL. Please paste the full link." });
      }
      const playlistId = playlistIdMatch[1];

      const userAgents = [
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
        'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
        'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
      ];
      
      async function fetchWithUA(url: string, ua: string) {
        return axios.get(url, {
          headers: {
            'User-Agent': ua,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://open.spotify.com/',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Upgrade-Insecure-Requests': '1'
          },
          timeout: 20000,
          validateStatus: () => true
        });
      }

      let rawData: any = null;
      let usedHtml: string = "";

      // Try multiple User-Agents and Scraper Strategies
      for (const ua of userAgents) {
        if (rawData) break;

        const urlsToTry = [
          `https://open.spotify.com/playlist/${playlistId}`,
          `https://open.spotify.com/embed/playlist/${playlistId}`
        ];

        for (const url of urlsToTry) {
           try {
              const response = await fetchWithUA(url, ua);
              const html = response.data;
              if (!html) continue;
              usedHtml = html;

              // Pattern 1: JSON scripts by ID (initial-state, resource, __NEXT_DATA__)
              const jsonIds = ['initial-state', 'resource', '__NEXT_DATA__'];
              for (const id of jsonIds) {
                const match = html.match(new RegExp(`<script[^>]*id="${id}"[^>]*>([\\s\\S]*?)<\\/script>`));
                if (match) {
                  const content = match[1].trim();
                  try {
                    // Try direct JSON
                    let parsed = JSON.parse(content);
                    
                    // If it's a string (wrapped JSON), parse again
                    if (typeof parsed === 'string') {
                      try { parsed = JSON.parse(parsed); } catch(e) {}
                    }

                    if (parsed.name || parsed.entities || parsed.tracks || parsed.props) {
                      rawData = parsed;
                      console.log(`Found rawData in #${id}`);
                      break;
                    }
                  } catch (e) {
                    // Try Base64
                    try {
                      const decoded = Buffer.from(content, 'base64').toString();
                      const parsed = JSON.parse(decoded);
                      if (parsed.name || parsed.entities || parsed.tracks || parsed.props) {
                        rawData = parsed;
                        console.log(`Found rawData in #${id} (Base64)`);
                        break;
                      }
                    } catch (err) {}
                  }
                }
              }

              if (rawData) break;

              // Pattern 3: Embed-specific track list regex
              if (url.includes('/embed/')) {
                 const embedTracks = [...html.matchAll(/{"track":{"name":"([^"]+)"[^{}]*,"uri":"spotify:track:([a-zA-Z0-9]+)"[^{}]*,"artists":\[{"name":"([^"]+)"/g)];
                 if (embedTracks.length > 0) {
                    rawData = {
                      name: html.match(/<title>([^<]+)<\/title>/)?.[1] || "Imported Playlist",
                      tracks: {
                        items: embedTracks.map(m => ({
                          track: {
                            id: m[2],
                            name: m[1],
                            artists: [{ name: m[3] }]
                          }
                        }))
                      }
                    };
                    console.log(`Found ${embedTracks.length} tracks via Embed Regex`);
                    break;
                 }
              }

              // Pattern 4: Search for ANY script with playlist/track entities
              const scripts = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
              for (const script of scripts) {
                const innerMatch = script.match(/>([\s\S]*?)<\/script>/);
                const inner = innerMatch ? innerMatch[1].trim() : "";
                if (inner.includes('playlist') && (inner.includes('track') || inner.includes('items'))) {
                  try {
                    if (inner.includes('{')) {
                      const startIdx = inner.indexOf('{');
                      const endIdx = inner.lastIndexOf('}');
                      if (startIdx !== -1 && endIdx !== -1) {
                        const jsonStr = inner.substring(startIdx, endIdx + 1);
                        const json = JSON.parse(jsonStr);
                        if (json.name || json.entities || (json.tracks && json.tracks.items) || json.props) {
                          rawData = json;
                          console.log(`Found rawData in arbitrary script tag`);
                          break;
                        }
                      }
                    }
                  } catch (e) {}
                }
              }

              if (rawData) break;
           } catch (e) {
             console.warn(`Fetch with UA failed for ${url}`);
           }
        }
      }

      // Final Strategy: Fallback to Meta + Regex extraction if JSON parsing is still missing
      if (!rawData && usedHtml) {
        console.log("JSON parsing failed, falling back to Regex extraction");
        const ogTitle = usedHtml.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/)?.[1] ||
                       usedHtml.match(/<meta[^>]*content="([^"]+)"[^>]*property="og:title"/)?.[1];
        const ogImage = usedHtml.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/)?.[1] ||
                       usedHtml.match(/<meta[^>]*content="([^"]+)"[^>]*property="og:image"/)?.[1];
        const ogDescription = usedHtml.match(/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/)?.[1] ||
                             usedHtml.match(/<meta[^>]*content="([^"]+)"[^>]*property="og:description"/)?.[1];
        
        // Find track items in the HTML by looking for aria-labels (common pattern)
        const tracks = [];
        
        // Strategy A: Aria Labels
        const trackAriaMatches = [...usedHtml.matchAll(/aria-label="([^"]+) by ([^"]+)"/g)];
        for (const match of trackAriaMatches) {
          let [, name, artist] = match;
          if (name.startsWith('Track: ')) name = name.replace('Track: ', '');
          
          tracks.push({
            track: {
              id: `html-aria-${Math.random().toString(36).substr(2, 9)}`,
              name,
              artists: [{ name: artist }],
              album: { name: ogTitle || "Unknown Album", images: [{ url: ogImage }] }
            }
          });
        }

        // Strategy B: OgDescription Parsing (Spotify often list tracks here like "Song 1, Song 2, ...")
        if (tracks.length === 0 && ogDescription) {
          const descTracks = ogDescription.split(',').map(s => s.trim()).filter(s => s.length > 2);
          if (descTracks.length > 1) {
             for (const t of descTracks) {
               tracks.push({
                 track: {
                   id: `html-desc-${Math.random().toString(36).substr(2, 9)}`,
                   name: t,
                   artists: [{ name: "Artist" }],
                   album: { name: ogTitle || "Unknown Album", images: [{ url: ogImage }] }
                 }
               });
             }
          }
        }

        // Strategy C: Link Matches
        if (tracks.length === 0) {
          const trackLinkMatches = [...usedHtml.matchAll(/href="\/track\/([a-zA-Z0-9]+)"[^>]*>([^<]+)/g)];
          for (const match of trackLinkMatches) {
            const [, id, name] = match;
            if (name === "Home" || name === "Search" || name.includes("Spotify")) continue;
            tracks.push({
              track: {
                id: `html-link-${id}`,
                name: name.trim(),
                artists: [{ name: "Unknown Artist" }],
                album: { name: ogTitle || "Unknown Album", images: [{ url: ogImage }] }
              }
            });
          }
        }

        if (tracks.length > 0 && ogTitle) {
          rawData = {
            name: ogTitle,
            images: [{ url: ogImage }],
            tracks: { items: tracks }
          };
          console.log(`Extracted ${tracks.length} tracks via Regex/Meta fallback`);
        }
      }

      if (!rawData) {
        const ogTitle = usedHtml.match(/<meta property="og:title" content="([^"]+)"/)?.[1];
        if (ogTitle) {
           return res.status(400).json({ 
             error: `We found playlist "${ogTitle}", but Spotify is blocking access to the track list. Please try a different public playlist or ensure this one isn't a "Blend".`
           });
        }
        return res.status(400).json({ error: "Could not read playlist data. Ensure it is a PUBLIC Spotify playlist and not a private Blend." });
      }

      let normalized: any = { name: "Imported Playlist", images: [], tracks: { items: [] } };

      // Multi-layered Normalization Strategy
      function extractFromAnywhere(obj: any): any[] {
        if (!obj || typeof obj !== 'object') return [];
        
        // Priority 1: Direct matches for known Spotify structures
        if (obj.tracks?.items) return obj.tracks.items;
        if (obj.playlistData?.tracks?.items) return obj.playlistData.tracks.items;
        if (obj.pageProps?.playlistData?.tracks?.items) return obj.pageProps.playlistData.tracks.items;
        if (obj.state?.playlist?.tracks?.items) return obj.state.playlist.tracks.items;
        
        // Priority 2: entities.items structure (Common in 'initial-state')
        if (obj.entities?.items) {
          const tracks = [];
          for (const key in obj.entities.items) {
            if (key.includes(':track:')) {
              tracks.push({ track: obj.entities.items[key] });
            }
          }
          if (tracks.length > 0) return tracks;
        }

        // Priority 3: Recursive search for anything that looks like an array of tracks
        if (Array.isArray(obj)) {
          if (obj.length > 0 && (obj[0].track || obj[0].name || obj[0].item?.data)) {
            return obj;
          }
        }

        let tracks: any[] = [];
        for (const key in obj) {
          // Skip enormous metadata keys that aren't tracks
          if (key === 'config' || key === 'session' || key === 'user') continue;
          
          if (typeof obj[key] === 'object' && obj[key] !== null) {
            const found = extractFromAnywhere(obj[key]);
            if (found.length > tracks.length) tracks = found;
          }
        }
        return tracks;
      }

      const foundTracks = extractFromAnywhere(rawData);
      
      const playlistName = rawData.name || rawData.playlistData?.name || rawData.props?.pageProps?.playlistData?.name || "Imported Playlist";
      const rawImages = rawData.images || rawData.playlistData?.images || rawData.props?.pageProps?.playlistData?.images || [];
      const playlistImage = Array.isArray(rawImages) ? (rawImages[0]?.url || rawImages[0]?.sources?.[0]?.url || "") : "";

      normalized = {
        name: playlistName,
        images: Array.isArray(rawImages) ? rawImages : [],
        tracks: { items: foundTracks }
      };

      const tracksData = normalized.tracks?.items || [];
      console.log(`Final normalized track count: ${tracksData.length}`);

      if (tracksData.length === 0) {
        return res.status(400).json({ error: "Empty playlist or private data. Ensure it is a PUBLIC playlist." });
      }

      const enrichedTracks = await enrichTracks(tracksData.slice(0, 50), playlistImage);

      async function enrichTracks(items: any[], defaultImg: string) {
        const result = [];
        for (const item of items) {
          const track = item.track || item.item?.data || item;
          if (!track || !track.name) continue;

          const name = track.name;
          const artist = track.artists?.map((a: any) => a.name || a.profile?.name).join(", ") || 
                         track.artists?.items?.map((a: any) => a.profile?.name || a.name).join(", ") || 
                         "Unknown Artist";
          const albumName = track.album?.name || track.albumOfTrack?.name || "Unknown Album";
          const coverArt = track.album?.images?.[0]?.url || track.albumOfTrack?.coverArt?.sources?.[0]?.url || defaultImg;

          let videoId = null;
          try {
            await new Promise(r => setTimeout(r, 60));
            const searchResults = await youtube.GetListByKeyword(`${name} ${artist} official audio`, false, 1);
            videoId = searchResults.items[0]?.id;
          } catch (e) {}

          result.push({
            id: track.id || `sp-${Math.random().toString(36).substr(2, 9)}`,
            name,
            artist,
            album: albumName,
            duration: track.duration_ms ? Math.floor(track.duration_ms / 1000) : 0,
            image: coverArt,
            youtubeId: videoId,
            fileUrl: track.preview_url || ""
          });
        }
        return result;
      }

      res.json({
        name: playlistName,
        coverArt: playlistImage,
        tracks: enrichedTracks
      });
    } catch (error: any) {
      console.error("Scraping Global Error:", error.message);
      res.status(500).json({ error: "Failed to sync. Please check the URL and ensure the playlist is Public." });
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
