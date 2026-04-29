import Dexie, { type Table } from 'dexie';
import { Song, Playlist } from '../types';

export class MusicDatabase extends Dexie {
  songs!: Table<Song>;
  playlists!: Table<Playlist>;
  favorites!: Table<{ id: string }>;

  constructor() {
    super('VaultMusicDB');
    this.version(1).stores({
      songs: 'id, name, artist, album, youtubeId, lyrics',
      playlists: 'id, name, createdAt',
      favorites: 'id'
    });
  }
}

export const db = new MusicDatabase();
