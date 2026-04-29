/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Song {
  id: string;
  name: string;
  artist: string;
  duration: number; // in seconds
  fileUrl: string; // Blob or DataURL
  youtubeId?: string; // YouTube video ID for full playback
  coverArt: string; // Procedurally generated gradient
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
