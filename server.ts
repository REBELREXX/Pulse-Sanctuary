/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import dotenv from "dotenv";
// @ts-ignore
import youtube from "youtube-search-api";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

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
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Version/17.4.1 Safari/537.36',
        'WhatsApp/2.21.12.21 A',
        'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
      ];
      
      async function fetchWithUA(url: string, ua: string) {
        return axios.get(url, {
          headers: {
            'User-Agent': ua,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.google.com/',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Upgrade-Insecure-Requests': '1'
          },
          timeout: 15000,
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
                    const parsed = JSON.parse(content);
                    if (parsed.name || parsed.entities || parsed.tracks) {
                      rawData = parsed;
                      break;
                    }
                  } catch (e) {
                    // Try Base64
                    try {
                      const decoded = Buffer.from(content, 'base64').toString();
                      const parsed = JSON.parse(decoded);
                      if (parsed.name || parsed.entities || parsed.tracks) {
                        rawData = parsed;
                        break;
                      }
                    } catch (err) {}
                  }
                }
              }

              if (rawData) break;

              // Pattern 2: Search for ANY script with playlist/track entities
              const scripts = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
              for (const script of scripts) {
                if (script.includes('playlist') && (script.includes('track') || script.includes('items'))) {
                  try {
                    const innerMatch = script.match(/>([\s\S]*?)<\/script>/);
                    const inner = innerMatch ? innerMatch[1].trim() : "";
                    if (inner.includes('{')) {
                      const startIdx = inner.indexOf('{');
                      const endIdx = inner.lastIndexOf('}');
                      if (startIdx !== -1 && endIdx !== -1) {
                        const jsonStr = inner.substring(startIdx, endIdx + 1);
                        const json = JSON.parse(jsonStr);
                        if (json.name || json.entities || (json.tracks && json.tracks.items)) {
                          rawData = json;
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
        const ogTitle = usedHtml.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/)?.[1] ||
                       usedHtml.match(/<meta[^>]*content="([^"]+)"[^>]*property="og:title"/)?.[1];
        const ogImage = usedHtml.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/)?.[1] ||
                       usedHtml.match(/<meta[^>]*content="([^"]+)"[^>]*property="og:image"/)?.[1];
        
        // Find track items in the HTML by looking for aria-labels (common pattern)
        const tracks = [];
        const trackAriaMatches = [...usedHtml.matchAll(/aria-label="([^"]+) by ([^"]+)"/g)];
        const trackLinkMatches = [...usedHtml.matchAll(/href="\/track\/([a-zA-Z0-9]+)"[^>]*>([^<]+)/g)];
        
        for (const match of trackAriaMatches) {
          let [, name, artist] = match;
          // Clean "Track: " prefix if present
          if (name.startsWith('Track: ')) name = name.replace('Track: ', '');
          
          tracks.push({
            track: {
              id: `html-aria-${Math.random().toString(36).substr(2, 9)}`,
              name,
              artists: [{ name: artist }],
              album: { name: ogTitle, images: [{ url: ogImage }] }
            }
          });
        }

        // If no aria matches, try link matches
        if (tracks.length === 0) {
          for (const match of trackLinkMatches) {
            const [, id, name] = match;
            if (name === "Home" || name === "Search") continue;
            tracks.push({
              track: {
                id: `html-link-${id}`,
                name: name.trim(),
                artists: [{ name: "Unknown Artist" }],
                album: { name: ogTitle, images: [{ url: ogImage }] }
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
        }
      }

      // Final Strategy: Gemini Robust Scraper (The "Smart" way)
      if (!rawData && usedHtml && process.env.GEMINI_API_KEY) {
        try {
          console.log("Starting Gemini-powered scraping...");
          // Truncate HTML to focus on body and scripts to save tokens, but keep essential structure
          const htmlChunk = usedHtml.substring(0, 500000); // 500k should be plenty for any playlist
          
          const prompt = `Extract all track information from this Spotify playlist page HTML. 
          Return a JSON object with:
          - "name": playlist name
          - "images": [{ "url": "cover image url" }]
          - "tracks": { "items": [ { "track": { "name": "track name", "artists": [{ "name": "artist name" }], "album": { "images": [{ "url": "image url" }] } } } ] }
          Focus on data inside <script> tags with ids like "initial-state", "resource", or "__NEXT_DATA__", or track lists in the <body>.
          Return ONLY valid JSON.`;

          const response = await genAI.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [{ parts: [{ text: prompt }, { text: htmlChunk }] }],
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  images: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: { url: { type: Type.STRING } }
                    }
                  },
                  tracks: {
                    type: Type.OBJECT,
                    properties: {
                      items: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            track: {
                              type: Type.OBJECT,
                              properties: {
                                name: { type: Type.STRING },
                                artists: {
                                  type: Type.ARRAY,
                                  items: {
                                    type: Type.OBJECT,
                                    properties: { name: { type: Type.STRING } }
                                  }
                                },
                                album: {
                                  type: Type.OBJECT,
                                  properties: {
                                    images: {
                                      type: Type.ARRAY,
                                      items: {
                                        type: Type.OBJECT,
                                        properties: { url: { type: Type.STRING } }
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                },
                required: ["name"]
              }
            }
          });

          if (response.text) {
             const cleanedJson = JSON.parse(response.text);
             if (cleanedJson.name && cleanedJson.tracks?.items?.length > 0) {
               rawData = cleanedJson;
               console.log(`Gemini extracted ${rawData.tracks.items.length} tracks.`);
             }
          }
        } catch (e: any) {
          console.error("Gemini scraping failed:", e.message);
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

      // Normalization Logic for different Spotify Data Structures
      if (rawData.name && rawData.tracks) {
        normalized = rawData;
      } else if (rawData.entities?.items) {
        const pKey = Object.keys(rawData.entities.items).find(k => k.includes(':playlist:'));
        if (pKey) {
          const p = rawData.entities.items[pKey];
          normalized = {
            name: p.name,
            images: p.images?.items?.map((i: any) => ({ url: i.sources?.[0]?.url })),
            tracks: {
              items: p.content?.items?.map((i: any) => ({ track: i.item?.data || i }))
            }
          };
        }
      } else if (rawData.props?.pageProps?.playlistData) {
        normalized = rawData.props.pageProps.playlistData;
      }

      const playlistName = normalized.name || "Imported Playlist";
      const playlistImage = normalized.images?.[0]?.url || "";
      const tracksData = normalized.tracks?.items || [];

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
