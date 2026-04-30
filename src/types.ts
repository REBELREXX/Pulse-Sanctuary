/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Song {
  id: string;
  name: string;
  artist: string;
  album?: string;
  genre?: string;
  description?: string;
  duration: number; // in seconds
  durationStr?: string;
  fileUrl: string; // Blob or DataURL
  youtubeId?: string; // YouTube video ID for full playback
  blob?: Blob; // Actual file data for local files
  lyrics?: string; // Raw lyrics
  lyricLines?: { time: number; text: string; duration?: number }[]; // Time-synced lyrics
  coverArt: string; // Procedurally generated gradient or AI generated
  addedAt: number;
}

export interface Playlist {
  id: string;
  name: string;
  songIds: string[];
  coverArt: string;
  createdAt: number;
}

export enum PlaybackMode {
  ORDER = 'order',
  SHUFFLE = 'shuffle'
}
