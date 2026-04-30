/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence, Reorder } from 'motion/react';
import React, { useState, useRef, useEffect } from 'react';
import ReactPlayer from 'react-player';

const Player = ReactPlayer as any;
import { 
  Play, Pause, SkipBack, SkipForward, 
  Plus, Search, MoreHorizontal, ListMusic, 
  Settings, User, Music, Shuffle, Repeat, Volume2, Sparkles, Wand2, Loader2,
  ListPlus, Trash2 as Trash, GripVertical, X, Edit2, LayoutGrid, Heart, Library, MessageSquare, ListOrdered
} from 'lucide-react';
import Background from './components/Background';
import Visualizer from './components/Visualizer';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { Song, Playlist, PlaybackMode } from './types';
import { generateProceduralArt, getAccentColor, getCoverBackground } from './utils/proceduralArt';
import { db } from './lib/db';
import { enrichSongMetadata, generateSongCover } from './services/aiService';

/**
 * Cockpit component for playback controls
 */
function PlayCockpit({ audio, activeTab }: { audio: any, activeTab: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6 sm:p-8 backdrop-blur-3xl relative overflow-hidden group shadow-2xl shadow-black/50">
      <div 
        className="absolute inset-0 opacity-10 blur-[80px] pointer-events-none transition-all duration-1000"
        style={{ background: getCoverBackground(audio.currentSong?.coverArt) }}
      />
      <div className="relative z-10 space-y-6 sm:space-y-8">
        {activeTab === 'library' && audio.currentSong && (
          <div className="flex items-center gap-4 p-2 bg-white/5 rounded-2xl border border-white/10">
            <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 shadow-lg">
              <div className="w-full h-full" style={{ background: getCoverBackground(audio.currentSong.coverArt) }} />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold line-clamp-1 text-sm tracking-tight">{audio.currentSong.name}</h4>
              <p className="text-[9px] uppercase tracking-widest font-black opacity-40">{audio.currentSong.artist}</p>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="h-1.5 w-full bg-white/10 rounded-full cursor-pointer relative group/progress" onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const pct = x / rect.width;
            if (audio.duration) audio.seek(pct * audio.duration);
          }}>
            <motion.div 
              className="h-full bg-white rounded-full relative"
              initial={{ width: 0 }}
              animate={{ width: `${audio.duration ? (audio.progress / audio.duration) * 100 : 0}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-[0_0_15px_white] scale-100 group-hover/progress:scale-125 transition-transform" />
            </motion.div>
          </div>
          <div className="flex justify-between text-[10px] font-black opacity-40 uppercase tracking-widest">
            <span>{Math.floor(audio.progress / 60)}:{Math.floor(audio.progress % 60).toString().padStart(2, '0')}</span>
            <span>{audio.duration ? `${Math.floor(audio.duration / 60)}:${Math.floor(audio.duration % 60).toString().padStart(2, '0')}` : '--:--'}</span>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => audio.setPlaybackMode(audio.playbackMode === PlaybackMode.SHUFFLE ? PlaybackMode.ORDER : PlaybackMode.SHUFFLE)}
              className={`p-3 rounded-xl transition-all ${audio.playbackMode === PlaybackMode.SHUFFLE ? 'bg-[#1DB954]/20 text-[#1DB954]' : 'opacity-40 hover:opacity-100 hover:bg-white/5'}`}
            >
              <Shuffle className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-4 sm:gap-8">
              <button onClick={audio.prevSong} className="p-3 opacity-60 hover:opacity-100 active:scale-90 transition-all hover:bg-white/5 rounded-full">
                <SkipBack className="w-6 h-6 fill-white" />
              </button>
              <button 
                onClick={audio.togglePlay}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-[0_0_40px_rgba(255,255,255,0.3)]"
              >
                {audio.isPlaying ? <Pause className="w-8 h-8 sm:w-10 sm:h-10 fill-black" /> : <Play className="w-8 h-8 sm:w-10 sm:h-10 fill-black translate-x-1" />}
              </button>
              <button onClick={audio.nextSong} className="p-3 opacity-60 hover:opacity-100 active:scale-90 transition-all hover:bg-white/5 rounded-full">
                <SkipForward className="w-6 h-6 fill-white" />
              </button>
            </div>
            <button className="p-3 opacity-40 hover:opacity-100 hover:bg-white/5 rounded-xl transition-all">
              <Repeat className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-4 p-4 bg-white/5 rounded-[1.5rem] border border-white/10">
            <Volume2 className="w-4 h-4 opacity-40" />
            <input 
              type="range" 
              min="0" max="1" step="0.01" 
              value={audio.volume}
              onChange={(e) => audio.setVolume(parseFloat(e.target.value))}
              className="w-full accent-white h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [activeSection, setActiveSection] = useState<'home' | 'favorites' | 'playlists' | 'settings'>('home');
  const [activeTab, setActiveTab] = useState<'library' | 'playing'>('library');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [playingPlaylistId, setPlayingPlaylistId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [isEnriching, setIsEnriching] = useState(false);
  const [activePlayView, setActivePlayView] = useState<'cover' | 'visualizer' | 'queue'>('cover');
  
  const effectiveSongs = playingPlaylistId 
    ? songs.filter(s => playlists.find(p => p.id === playingPlaylistId)?.songIds.includes(s.id))
    : songs;

  const audio = useAudioPlayer(effectiveSongs);
  const playerRef = useRef<any>(null);
  const [songToEdit, setSongToEdit] = useState<Song | null>(null);

  // Persistence: Load data on mount from IndexedDB
  useEffect(() => {
    async function loadLibrary() {
      try {
        const savedSongs = await db.songs.toArray();
        const savedPlaylists = await db.playlists.toArray();
        const savedFavorites = await db.favorites.toArray();

        // Regenerate Blob URLs for local files
        const hydratedSongs = savedSongs.map(song => {
          if (song.blob) {
            return { ...song, fileUrl: URL.createObjectURL(song.blob) };
          }
          return song;
        });

        setSongs(hydratedSongs);
        setPlaylists(savedPlaylists);
        setFavoriteIds(new Set(savedFavorites.map(f => f.id)));
      } catch (e) {
        console.error("Failed to load library from IndexedDB", e);
      }
    }
    loadLibrary();

    // Cleanup object URLs on unmount
    return () => {
      songs.forEach(s => {
        if (s.fileUrl.startsWith('blob:')) {
          URL.revokeObjectURL(s.fileUrl);
        }
      });
    };
  }, []);

  // Sync favorites to DB
  useEffect(() => {
    async function syncFavs() {
      await db.favorites.clear();
      await db.favorites.bulkAdd(Array.from(favoriteIds).map(id => ({ id })));
    }
    syncFavs();
  }, [favoriteIds]);

  // Sync seek to ReactPlayer
  useEffect(() => {
    if (audio.currentSong?.youtubeId && playerRef.current) {
      const currentPlayerTime = playerRef.current.getCurrentTime();
      if (Math.abs(currentPlayerTime - audio.progress) > 2) {
        playerRef.current.seekTo(audio.progress, 'seconds');
      }
    }
  }, [audio.progress, audio.currentSong]);

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(favoriteIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setFavoriteIds(next);
  };
  const [showSyncOverlay, setShowSyncOverlay] = useState(false);
  const [showCreatePlaylistModal, setShowCreatePlaylistModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [songToAddToPlaylist, setSongToAddToPlaylist] = useState<Song | null>(null);
  const [isTaskRunning, setIsTaskRunning] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [spotifyUrl, setSpotifyUrl] = useState('');
  const [syncStats, setSyncStats] = useState<{ total: number, imported: number } | null>(null);

  const handleSpotifySync = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!spotifyUrl) return;
    setIsTaskRunning(true);
    setSyncError('');
    setSyncStats(null);

    try {
      const response = await fetch('/api/spotify/playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlistUrl: spotifyUrl }),
      });

      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || 'Sync failed');

      // Server returns enriched tracks with youtubeId
      const importedSongs: Song[] = data.tracks.map((t: any, index: number) => ({
        id: `spotify-${t.id}-${Date.now()}-${index}`,
        name: t.name,
        artist: t.artist,
        album: t.album,
        duration: t.duration || 0,
        durationStr: t.duration ? `${Math.floor(t.duration / 60)}:${Math.floor(t.duration % 60).toString().padStart(2, '0')}` : undefined,
        fileUrl: t.fileUrl || "",
        youtubeId: t.youtubeId,
        coverArt: t.image || generateProceduralArt(t.name),
        addedAt: Date.now(),
      }));

      const newPlaylist: Playlist = {
        id: Math.random().toString(36).substr(2, 9),
        name: data.name,
        songIds: importedSongs.map(s => s.id),
        coverArt: data.coverArt || generateProceduralArt(data.name),
        createdAt: Date.now(),
      };

      // Persistence: Save to DB
      await db.songs.bulkAdd(importedSongs);
      await db.playlists.add(newPlaylist);

      // Use functional state updates to ensure consistency
      setSongs(prev => {
        const existingIds = new Set(prev.map(s => s.id));
        const filteredNew = importedSongs.filter(s => !existingIds.has(s.id));
        return [...prev, ...filteredNew];
      });
      
      setPlaylists(prev => [...prev, newPlaylist]);
      setSyncStats({ total: data.totalFound || importedSongs.length, imported: importedSongs.length });
      setIsTaskRunning(false);
      setSpotifyUrl('');
      
      // Auto-close after 3 seconds on success
      setTimeout(() => setShowSyncOverlay(false), 4000);
    } catch (error: any) {
      console.error('Sync failed:', error);
      setSyncError(error.message || 'Failed to sync. Please ensure the link is a valid public Spotify link.');
      setIsTaskRunning(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const name = file.name.replace(/\.[^/.]+$/, "");
    const url = URL.createObjectURL(file);
    
    const newSong: Song = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      artist: 'Unknown Artist',
      duration: 0,
      fileUrl: url,
      blob: file, // Store actual file binary in IndexedDB
      coverArt: generateProceduralArt(name),
      addedAt: Date.now(),
    };

    try {
      await db.songs.add(newSong);
      setSongs(prev => [...prev, newSong]);
      setIsUploading(false);

      // Trigger automatic background enrichment
      enrichInBackground(newSong);
    } catch (err) {
      console.error("Failed to save uploaded song", err);
    }
  };

  const enrichInBackground = async (song: Song) => {
    try {
      const enriched = await enrichSongMetadata(song.name, song.artist);
      if (enriched) {
        const aiCover = await generateSongCover(enriched.description, enriched.name);
        const updated: Song = {
          ...song,
          name: enriched.name,
          artist: enriched.artist,
          album: enriched.album,
          lyrics: enriched.lyrics,
          lyricLines: enriched.lyricLines,
          coverArt: aiCover || song.coverArt
        };
        await db.songs.put(updated);
        setSongs(prev => prev.map(s => s.id === song.id ? updated : s));
      }
    } catch (err) {
      console.error("Background enrichment failed", err);
    }
  };

  const deleteSong = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this song?")) return;
    
    try {
      await db.songs.delete(id);
      setSongs(prev => prev.filter(s => s.id !== id));
      // Remove from playlists
      const updatedPlaylists = playlists.map(p => ({
        ...p,
        songIds: p.songIds.filter(sid => sid !== id)
      }));
      setPlaylists(updatedPlaylists);
      await Promise.all(updatedPlaylists.map(p => db.playlists.put(p)));
      
      const newFavs = new Set(favoriteIds);
      newFavs.delete(id);
      setFavoriteIds(newFavs);
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  const updateSong = async (updated: Song) => {
    try {
      await db.songs.put(updated);
      setSongs(prev => prev.map(s => s.id === updated.id ? updated : s));
      setSongToEdit(null);
    } catch (err) {
      console.error("Update failed", err);
    }
  };

  const handleMagicEnrich = async () => {
    if (!songToEdit) return;
    setIsEnriching(true);
    try {
      const enriched = await enrichSongMetadata(songToEdit.name, songToEdit.artist);
      if (enriched) {
        const aiCover = await generateSongCover(enriched.description, enriched.name);
        const updatedTrack: Song = {
          ...songToEdit,
          name: enriched.name,
          artist: enriched.artist,
          album: enriched.album,
          lyrics: enriched.lyrics,
          lyricLines: enriched.lyricLines,
          coverArt: aiCover || songToEdit.coverArt
        };
        
        // Persist immediately!
        await db.songs.put(updatedTrack);
        setSongs(prev => prev.map(s => s.id === updatedTrack.id ? updatedTrack : s));
        setSongToEdit(updatedTrack);
      }
    } catch (err) {
      console.error("Magic Enrichment failed", err);
    } finally {
      setIsEnriching(false);
    }
  };

  const selectedPlaylist = playlists.find(p => p.id === selectedPlaylistId);
  const playlistSongs = selectedPlaylist ? songs.filter(s => selectedPlaylist.songIds.includes(s.id)) : [];

  const filteredSongs = songs.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.album && s.album.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (s.genre && s.genre.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const playPlaylistSong = (songId: string) => {
    setPlayingPlaylistId(selectedPlaylistId);
    audio.playSong(songId);
  };

  return (
    <div className="min-h-screen text-white font-sans selection:bg-purple-500/30">
      <Background />
      
      {/* YouTube Player (Invisible) */}
      {audio.currentSong?.youtubeId && (
        <div className="hidden">
          <Player
            ref={playerRef}
            url={`https://www.youtube.com/watch?v=${audio.currentSong.youtubeId}`}
            playing={audio.isPlaying}
            volume={audio.volume}
            onProgress={(state: any) => audio.setProgress(state.playedSeconds)}
            onDuration={(d: any) => audio.setDuration(d)}
            onEnded={() => audio.nextSong()}
            config={{
              youtube: {
                playerVars: { autoplay: 1, controls: 0, rel: 0 }
              }
            }}
          />
        </div>
      )}
      
      {/* 1. Page Header */}
      <header className="fixed top-0 left-0 right-0 z-50 px-8 py-6 flex items-center justify-between backdrop-blur-sm bg-black/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Music className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tighter uppercase">Pulse</span>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]" />
            <span className="text-[10px] uppercase tracking-widest opacity-40 font-bold">System Online</span>
          </div>
          <button className="p-2 rounded-full hover:bg-white/5 transition-colors">
            <Settings className="w-5 h-5 opacity-60" />
          </button>
          <button className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/5 transition-colors overflow-hidden">
            <User className="w-6 h-6 opacity-60" />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-24 sm:pt-32 pb-32">
        <AnimatePresence mode="wait">
          {activeSection === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="mb-8 p-4 bg-white/5 rounded-3xl border border-white/10 sm:bg-transparent sm:border-none sm:p-0">
                <motion.h1 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-3xl sm:text-5xl font-bold mb-2 sm:mb-4 tracking-tight leading-tight"
                >
                  Your Sanctuary.
                </motion.h1>
                <motion.p 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-white/40 text-[10px] sm:text-xs tracking-widest uppercase font-black"
                >
                  {songs.length} tracks • {playlists.length} playlists
                </motion.p>
              </div>

              <div className="flex flex-col gap-8 items-start">
                <div className="w-full">
                  <div className="mb-6 flex p-1 bg-white/5 rounded-2xl border border-white/10 w-fit">
                    <button 
                      onClick={() => setActiveTab('library')}
                      className={`px-6 py-2.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'library' ? 'bg-white text-black shadow-lg' : 'text-white/30 truncate'}`}
                    >
                      Library
                    </button>
                    <button 
                      onClick={() => setActiveTab('playing')}
                      className={`px-6 py-2.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'playing' ? 'bg-white text-black shadow-lg' : 'text-white/30'}`}
                    >
                      Now Playing
                    </button>
                  </div>

                  <AnimatePresence mode="wait">
                    {activeTab === 'library' ? (
                      <motion.div 
                        key="library"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className="space-y-6"
                      >
                        <div className="flex flex-col sm:flex-row gap-3">
                          <div className="relative flex-1">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 opacity-30" />
                            <input 
                              type="text" 
                              placeholder="Search tracks..." 
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="w-full bg-white/5 border border-white/10 rounded-[1.25rem] py-4 pl-12 pr-4 outline-none focus:border-white/20 transition-all text-sm placeholder:opacity-30"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => setIsUploading(true)}
                              className="flex-1 py-4 px-6 bg-white text-black rounded-[1.25rem] font-bold flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all text-[10px] uppercase tracking-widest"
                            >
                              <Plus className="w-4 h-4" />
                              <span>Add</span>
                            </button>
                            <button 
                              onClick={() => setShowCreatePlaylistModal(true)}
                              className="flex-1 py-4 px-6 bg-white/10 border border-white/10 text-white rounded-[1.25rem] font-bold flex items-center justify-center gap-2 hover:bg-white/20 active:scale-95 transition-all text-[10px] uppercase tracking-widest"
                            >
                              <ListMusic className="w-4 h-4" />
                              <span>List</span>
                            </button>
                          </div>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-[2rem] overflow-hidden">
                          {filteredSongs.length > 0 ? (
                            <div className="divide-y divide-white/5">
                              {filteredSongs.map((song) => (
                                <div 
                                  key={song.id} 
                                  onClick={() => audio.playSong(song.id)}
                                  className="group flex items-center gap-4 p-4 hover:bg-white/5 cursor-pointer transition-all active:scale-[0.98]"
                                >
                                  <div className="w-14 h-14 rounded-2xl overflow-hidden relative flex-shrink-0 shadow-2xl">
                                     <div className="absolute inset-0" style={{ background: song.coverArt }} />
                                     <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors">
                                        <Play className="w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity fill-white" />
                                     </div>
                                     {audio.currentSongId === song.id && audio.isPlaying && (
                                       <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                         <div className="flex gap-1 items-end h-4">
                                            {[1,2,3].map(i => (
                                              <motion.div 
                                                key={i}
                                                animate={{ height: [4, 16, 4] }}
                                                transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                                                className="w-1 bg-[#1DB954] rounded-full"
                                              />
                                            ))}
                                         </div>
                                       </div>
                                     )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h4 className={`text-base sm:text-lg font-bold truncate tracking-tight ${audio.currentSongId === song.id ? 'text-[#1DB954]' : 'text-white'}`}>{song.name}</h4>
                                    <div className="flex items-center gap-2 text-[10px] text-white/40 font-bold uppercase tracking-[0.15em] truncate">
                                      <span className="truncate">{song.artist}</span>
                                      {song.album && (
                                        <>
                                          <span className="w-1 h-1 rounded-full bg-white/20 flex-shrink-0" />
                                          <span className="opacity-60 truncate">{song.album}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 sm:gap-2">
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSongToEdit(song);
                                      }}
                                      className="p-3 text-white/20 hover:text-white transition-colors"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSongToAddToPlaylist(song);
                                      }}
                                      className="p-3 text-white/20 hover:text-[#1DB954] transition-colors"
                                    >
                                      <ListMusic className="w-5 h-5" />
                                    </button>
                                    <button 
                                      onClick={(e) => deleteSong(song.id, e)}
                                      className="p-3 text-white/10 hover:text-red-400 transition-colors"
                                    >
                                      <Trash className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="py-24 flex flex-col items-center opacity-20 gap-4 text-center px-4">
                              <Music className="w-16 h-16" />
                              <div className="space-y-1">
                                <p className="text-sm font-black uppercase tracking-[0.3em]">Vault is Empty</p>
                                <p className="text-[10px] opacity-60">Add some sound to your sanctuary.</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div 
                        key="playing"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-8"
                      >
                        <div className="max-w-[500px] mx-auto space-y-6 sm:space-y-8">
                            <div className="flex justify-center p-1 bg-white/5 rounded-2xl border border-white/10 w-fit mx-auto">
                              {[
                                { id: 'cover', icon: Music, label: 'Art' },
                                { id: 'visualizer', icon: Sparkles, label: 'Visuals' },
                                { id: 'queue', icon: ListOrdered, label: 'Next' }
                              ].map(v => (
                                <button 
                                  key={v.id}
                                  onClick={() => setActivePlayView(v.id as any)}
                                  className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activePlayView === v.id ? 'bg-white text-black shadow-lg' : 'text-white/30'}`}
                                >
                                  {v.label}
                                </button>
                              ))}
                            </div>

                            <AnimatePresence mode="wait">
                              {activePlayView === 'cover' ? (
                                <motion.div 
                                  key="cover"
                                  initial={{ opacity: 0, scale: 0.9, rotate: -2 }}
                                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                  exit={{ opacity: 0, scale: 0.9, rotate: 2 }}
                                  className="aspect-square rounded-[3rem] sm:rounded-[4rem] overflow-hidden relative shadow-[0_40px_100px_rgba(0,0,0,0.8)] group"
                                >
                                  <motion.div 
                                    animate={{ scale: [1, 1.05, 1] }}
                                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                                    className="absolute inset-0 bg-cover bg-center" 
                                    style={{ 
                                      background: getCoverBackground(audio.currentSong?.coverArt)
                                    }} 
                                  />
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                                  
                                  <div className="absolute top-10 right-10 z-20">
                                     <button 
                                       onClick={(e) => audio.currentSong && toggleFavorite(audio.currentSong.id, e)}
                                       className={`p-4 rounded-full backdrop-blur-xl border border-white/10 transition-all ${audio.currentSong && favoriteIds.has(audio.currentSong.id) ? 'bg-red-500 text-white' : 'bg-black/20 text-white/60'}`}
                                     >
                                       <Heart className={`w-6 h-6 ${audio.currentSong && favoriteIds.has(audio.currentSong.id) ? 'fill-current' : ''}`} />
                                     </button>
                                  </div>
                                  <div className="absolute bottom-10 left-10 right-10 text-center">
                                     <h2 className="text-3xl sm:text-4xl font-black mb-2 tracking-tighter leading-tight drop-shadow-2xl">
                                       {audio.currentSong?.name || 'Nothing playing'}
                                     </h2>
                                     <p className="text-[10px] sm:text-xs text-white/60 uppercase tracking-[0.3em] font-black drop-shadow-lg">
                                       {audio.currentSong?.artist || 'SELECT HARMONY'}
                                     </p>
                                  </div>
                                </motion.div>
                              ) : activePlayView === 'visualizer' ? (
                                <motion.div 
                                  key="visualizer"
                                  initial={{ opacity: 0, scale: 0.95 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.95 }}
                                  className="aspect-square rounded-[3rem] sm:rounded-[4rem] bg-black/40 border border-white/10 overflow-hidden relative group"
                                >
                                   <div className="absolute inset-0 flex items-center justify-center">
                                      <Visualizer 
                                        isPlaying={audio.isPlaying} 
                                        accentColor={audio.currentSong ? getAccentColor(audio.currentSong.name) : '#a855f7'} 
                                      />
                                   </div>
                                   <div className="absolute inset-x-0 bottom-12 text-center">
                                      <p className="text-[10px] font-black uppercase tracking-[0.5em] text-white/40 animate-pulse">Audio Feedback Active</p>
                                   </div>
                                </motion.div>
                              ) : (
                               <motion.div 
                                 key="queue"
                                 initial={{ opacity: 0, scale: 0.95 }}
                                 animate={{ opacity: 1, scale: 1 }}
                                 exit={{ opacity: 0, scale: 0.95 }}
                                 className="aspect-square rounded-[3.5rem] bg-white/[0.03] border border-white/10 p-6 flex flex-col overflow-hidden"
                               >
                                 <div className="flex items-center justify-between mb-4 px-2">
                                    <h3 className="text-xs font-black uppercase tracking-[0.2em] opacity-40">Upcoming Queue</h3>
                                    <p className="text-[10px] opacity-20">{audio.queue.length} Tracks</p>
                                 </div>
                                 <Reorder.Group 
                                   axis="y" 
                                   values={audio.queue} 
                                   onReorder={audio.setQueue}
                                   className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2 pb-6"
                                 >
                                   {audio.queue.map((id, index) => {
                                      const song = songs.find(s => s.id === id);
                                      if (!song) return null;
                                      const isCurrent = audio.currentSongId === id;
                                      
                                      return (
                                        <Reorder.Item 
                                          key={id} 
                                          value={id}
                                          initial={{ opacity: 0, y: 10 }}
                                          animate={{ 
                                            opacity: 1, 
                                            y: 0,
                                            scale: 1,
                                            backgroundColor: isCurrent ? "rgba(168, 85, 247, 0.15)" : "rgba(255, 255, 255, 0)"
                                          }}
                                          exit={{ opacity: 0, scale: 0.9 }}
                                          whileHover={{ scale: 1.01, backgroundColor: isCurrent ? "rgba(168, 85, 247, 0.2)" : "rgba(255, 255, 255, 0.05)" }}
                                          whileDrag={{ 
                                            scale: 1.05, 
                                            backgroundColor: "rgba(255, 255, 255, 0.15)",
                                            boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
                                            zIndex: 50
                                          }}
                                          transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                          className={`flex items-center gap-3 p-3 rounded-2xl transition-all group/item cursor-default border ${isCurrent ? 'border-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.1)]' : 'border-transparent'}`}
                                        >
                                          <div className="cursor-grab active:cursor-grabbing opacity-20 group-hover/item:opacity-60 transition-opacity p-1 flex-shrink-0">
                                            <GripVertical className="w-4 h-4" />
                                          </div>
                                          
                                          <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 relative">
                                             <div className="absolute inset-0" style={{ background: getCoverBackground(song.coverArt) }} />
                                             {isCurrent && audio.isPlaying && (
                                               <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                                 <div className="flex gap-0.5 items-end h-3">
                                                   {[1, 2, 3, 2].map((h, i) => (
                                                     <motion.div
                                                       key={i}
                                                       animate={{ height: [`${h * 25}%`, `${h * 100}%`, `${h * 25}%`] }}
                                                       transition={{ 
                                                         duration: 0.6, 
                                                         repeat: Infinity, 
                                                         delay: i * 0.15,
                                                         ease: "easeInOut"
                                                       }}
                                                       className="w-0.5 bg-white rounded-full"
                                                     />
                                                   ))}
                                                 </div>
                                               </div>
                                             )}
                                          </div>

                                          <div className="flex-1 min-w-0" onClick={() => audio.playSong(id)}>
                                            <h4 className={`text-xs font-bold truncate transition-colors ${isCurrent ? 'text-purple-300' : 'text-white'}`}>
                                              {song.name}
                                            </h4>
                                            <div className="flex items-center gap-1.5">
                                              {isCurrent && (
                                                <span className="w-1 h-1 rounded-full bg-purple-400 animate-pulse" />
                                              )}
                                              <p className={`text-[10px] truncate ${isCurrent ? 'text-purple-300/60' : 'opacity-40'}`}>
                                                {song.artist}
                                              </p>
                                            </div>
                                          </div>

                                          <div className="flex items-center gap-1">
                                             {isCurrent && !audio.isPlaying && (
                                               <Play className="w-3 h-3 text-white/40" />
                                              )}
                                             <button 
                                               onClick={(e) => {
                                                 e.stopPropagation();
                                                 audio.removeFromQueue(index);
                                               }}
                                               className="p-2 opacity-0 group-hover/item:opacity-40 hover:!opacity-100 transition-opacity"
                                             >
                                               <Trash className="w-3 h-3 text-white/60 hover:text-red-400 transition-colors" />
                                             </button>
                                          </div>
                                        </Reorder.Item>
                                      );
                                   })}
                                 </Reorder.Group>
                               </motion.div>
                             )}
                           </AnimatePresence>
                           <PlayCockpit audio={audio} activeTab={activeTab} />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}

          {activeSection === 'favorites' && (
            <motion.div
              key="favorites"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <h2 className="text-4xl font-bold">Your Favorites</h2>
              <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
                {songs.filter(s => favoriteIds.has(s.id)).length > 0 ? (
                  <div className="divide-y divide-white/5">
                    {songs.filter(s => favoriteIds.has(s.id)).map((song, idx) => (
                       <div 
                        key={song.id} 
                        onClick={() => audio.playSong(song.id)}
                        className="group flex items-center gap-4 p-4 hover:bg-white/5 cursor-pointer transition-all active:scale-[0.99]"
                      >
                        <div className="w-12 h-12 rounded-xl overflow-hidden relative flex-shrink-0 shadow-lg">
                           <div className="absolute inset-0" style={{ background: song.coverArt }} />
                           <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors">
                              <Play className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity fill-white" />
                           </div>
                        </div>
                                  <div className="flex-1 min-w-0">
                                    <h4 className={`text-base font-bold truncate tracking-tight ${audio.currentSongId === song.id ? 'text-[#1DB954]' : 'text-white'}`}>{song.name}</h4>
                                    <div className="flex items-center gap-2 text-[10px] text-white/40 font-black uppercase tracking-[0.1em] truncate">
                                      <span className="truncate">{song.artist}</span>
                                      {song.album && (
                                        <>
                                          <span className="w-1 h-1 rounded-full bg-white/20 flex-shrink-0" />
                                          <span className="opacity-60 truncate">{song.album}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSongToAddToPlaylist(song);
                            }}
                            className="p-2 opacity-60 hover:opacity-100 hover:text-[#1DB954]"
                          >
                            <ListMusic className="w-4 h-4" />
                          </button>
                          <button onClick={(e) => toggleFavorite(song.id, e)} className="text-red-400 p-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                          </button>
                        </div>
                        <span className="hidden sm:block text-xs text-white/30 font-mono w-16 text-right">
                          {song.durationStr || (song.duration ? `${Math.floor(song.duration / 60)}:${Math.floor(song.duration % 60).toString().padStart(2, '0')}` : '--:--')}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-20 text-center opacity-30">No favorites yet.</div>
                )}
              </div>
            </motion.div>
          )}

          {activeSection === 'playlists' && (
             <motion.div
               key="playlists"
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -20 }}
               className="space-y-8"
             >
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">Playlists</h2>
                <div className="flex gap-3 w-full sm:w-auto">
                  <button 
                    type="button"
                    onClick={() => setShowSyncOverlay(true)}
                    className="flex-1 sm:flex-none px-6 py-3 bg-[#1DB954] hover:bg-[#1ed760] rounded-full text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-500/20 active:scale-95"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zm5.503 17.293c-.216.353-.674.464-1.026.248-2.855-1.745-6.448-2.138-10.68-1.17-.404.092-.81-.16-.902-.564-.092-.403.16-.81.564-.902 4.636-1.06 8.59-.61 11.796 1.347.353.216.464.674.248 1.026v.013zm1.47-3.255c-.272.443-.848.58-1.29.308-3.267-2.008-8.246-2.59-12.11-1.418-.497.151-1.02-.132-1.173-.628-.151-.497.132-1.02.628-1.173 4.417-1.34 9.904-.688 13.637 1.61.442.271.58.847.308 1.301zm.127-3.39c-3.92-2.327-10.37-2.542-14.127-1.403-.6.182-1.24-.162-1.423-.762-.182-.6.162-1.24.762-1.423 4.307-1.307 11.43-1.05 15.962 1.637.54.32.716 1.015.397 1.554s-1.015.716-1.554.397z"/></svg>
                    <span>Spotify Sync</span>
                  </button>
                  <button 
                    onClick={() => setShowCreatePlaylistModal(true)}
                    className="flex-1 sm:flex-none px-6 py-3 bg-white/5 hover:bg-white/10 rounded-full text-xs font-bold uppercase tracking-widest transition-all border border-white/10 flex items-center justify-center active:scale-95"
                  >
                    New List
                  </button>
                </div>
               </div>
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {playlists.length > 0 ? playlists.map(p => (
                    <div 
                      key={p.id} 
                      onClick={() => setSelectedPlaylistId(p.id)}
                      className="bg-white/5 border border-white/10 p-6 rounded-[2rem] hover:bg-white/10 transition-colors cursor-pointer group"
                    >
                       <div className="w-full aspect-video rounded-2xl mb-4 overflow-hidden relative">
                         <div className="absolute inset-0" style={{ background: p.coverArt }} />
                         <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                           <Play className="w-12 h-12 fill-white" />
                         </div>
                       </div>
                       <h4 className="text-xl font-bold">{p.name}</h4>
                       <p className="text-xs opacity-40 uppercase tracking-widest font-bold">{p.songIds.length} tracks</p>
                    </div>
                  )) : (
                    <div className="col-span-full py-20 bg-white/5 rounded-3xl border border-dashed border-white/10 text-center opacity-30">
                      Empty world. Create your first playlist.
                    </div>
                  )}
               </div>

               {/* Playlist Detail Modal/Overlay */}
               <AnimatePresence>
                 {selectedPlaylist && (
                   <motion.div 
                     initial={{ opacity: 0 }}
                     animate={{ opacity: 1 }}
                     exit={{ opacity: 0 }}
                     className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-3xl overflow-y-auto px-8 py-32"
                    >
                                         <div className="max-w-4xl mx-auto px-4 sm:px-0">
                        <div className="flex flex-col md:flex-row gap-8 mb-12 items-center md:items-end">
                           <div className="w-48 h-48 sm:w-64 sm:h-64 rounded-[2.5rem] sm:rounded-[3rem] shadow-[0_30px_60px_rgba(0,0,0,0.5)] flex-shrink-0" style={{ background: selectedPlaylist.coverArt }} />
                           <div className="flex-1 text-center md:text-left">
                              <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.4em] opacity-40 mb-3">Collection</p>
                              <h1 className="text-4xl sm:text-6xl font-black mb-10 tracking-tighter leading-tight">{selectedPlaylist.name}</h1>
                              <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                                 <button 
                                   onClick={() => playPlaylistSong(selectedPlaylist.songIds[0])}
                                   className="bg-white text-black px-6 sm:px-8 py-3 sm:py-4 rounded-2xl sm:rounded-full font-black uppercase text-[10px] sm:text-xs tracking-widest flex items-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-xl"
                                 >
                                    <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-black" />
                                    Play All
                                 </button>
                                 <button 
                                   onClick={() => {
                                      audio.setPlaybackMode(PlaybackMode.SHUFFLE);
                                      playPlaylistSong(selectedPlaylist.songIds[Math.floor(Math.random() * selectedPlaylist.songIds.length)]);
                                   }}
                                   className="bg-white/10 px-6 sm:px-8 py-3 sm:py-4 rounded-2xl sm:rounded-full font-black uppercase text-[10px] sm:text-xs tracking-widest flex items-center gap-2 border border-white/10 hover:bg-white/20 transition-all"
                                 >
                                    <Shuffle className="w-4 h-4 sm:w-5 sm:h-5" />
                                    Shuffle
                                 </button>
                                 <button 
                                   onClick={() => setSelectedPlaylistId(null)}
                                   className="px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest text-white/40 hover:text-white transition-all ml-auto"
                                 >
                                   Back
                                 </button>
                              </div>
                           </div>
                        </div>

                        <div className="bg-white/5 rounded-[2.5rem] border border-white/10 overflow-hidden mb-32">
                           <div className="divide-y divide-white/5">
                              {playlistSongs.length > 0 ? playlistSongs.map((song, i) => (
                                <div 
                                  key={song.id}
                                  onClick={() => playPlaylistSong(song.id)}
                                  className="group flex items-center gap-4 p-4 hover:bg-white/5 cursor-pointer transition-all active:scale-[0.98]"
                                >
                                   <span className="w-6 text-[10px] font-black opacity-20 text-center">{i + 1}</span>
                                   <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0" style={{ background: getCoverBackground(song.coverArt) }} />
                                   <div className="flex-1 min-w-0">
                                      <h4 className={`text-base font-bold truncate tracking-tight ${audio.currentSongId === song.id ? 'text-[#1DB954]' : 'text-white'}`}>{song.name}</h4>
                                      <div className="flex items-center gap-2 text-[10px] text-white/40 font-black uppercase tracking-[0.1em] truncate">
                                        <span className="truncate">{song.artist}</span>
                                        {song.album && (
                                          <>
                                            <span className="w-1 h-1 rounded-full bg-white/20 flex-shrink-0" />
                                            <span className="opacity-60 truncate font-bold">{song.album}</span>
                                          </>
                                        )}
                                      </div>
                                   </div>
                                   <div className="flex items-center gap-1">
                                     <button 
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         setSongToEdit(song);
                                       }}
                                       className="p-3 text-white/20 hover:text-white transition-colors"
                                     >
                                       <Edit2 className="w-4 h-4" />
                                     </button>
                                     <button 
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         audio.addToQueue(song.id);
                                       }}
                                       className="p-3 text-white/20 hover:text-[#1DB954] transition-colors"
                                     >
                                       <ListPlus className="w-5 h-5" />
                                     </button>
                                   </div>
                                </div>
                              )) : (
                                <div className="py-20 text-center opacity-30">This playlist is empty.</div>
                              )}
                           </div>
                        </div>
                     </div>
                   </motion.div>
                 )}
               </AnimatePresence>
             </motion.div>
          )}

          {activeSection === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8 pb-32"
            >
              <div className="flex items-center gap-6 mb-12">
                <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-[#1DB954] to-[#121212] flex items-center justify-center shadow-2xl relative overflow-hidden group">
                  <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Edit2 className="w-6 h-6 text-white" />
                  </div>
                  <User className="w-10 h-10 text-white" />
                </div>
                <div>
                  <h2 className="text-4xl font-black tracking-tighter">Premium Owner</h2>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#1DB954]">Sonic Architect</p>
                </div>
              </div>

              <div className="space-y-4">
                 <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 space-y-8">
                    <div className="space-y-6">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30">Intelligence</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-2">
                           <Sparkles className="w-5 h-5 text-purple-400" />
                           <p className="text-[10px] font-black uppercase tracking-widest">Neural Visuals</p>
                           <p className="text-[9px] opacity-40">Enabled</p>
                        </div>
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-2">
                           <Wand2 className="w-5 h-5 text-blue-400" />
                           <p className="text-[10px] font-black uppercase tracking-widest">Art Gen</p>
                           <p className="text-[9px] opacity-40">Unlimited</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                       <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30">Performance</h4>
                       <div className="space-y-3">
                          <div className="flex justify-between items-center p-4 bg-white/5 rounded-2xl border border-white/5">
                            <span className="text-xs font-bold">Audio Quality</span>
                            <span className="text-[10px] font-black uppercase tracking-widest bg-white/10 px-3 py-1 rounded-full">Exotic 32-bit</span>
                          </div>
                          <div className="flex justify-between items-center p-4 bg-white/5 rounded-2xl border border-white/5">
                            <span className="text-xs font-bold">Local Cache</span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-[#1DB954]">{songs.length} Tracks</span>
                          </div>
                       </div>
                    </div>
                 </div>
                 
                 <button className="w-full py-6 bg-white/5 border border-white/10 rounded-[2rem] text-xs font-black uppercase tracking-[0.4em] hover:bg-white/10 transition-all active:scale-[0.98]">
                    Sync with Cloud
                 </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Mini Player Overlay - Sleek mobile-first design */}
      <AnimatePresence>
        {audio.currentSong && (activeSection !== 'home' || activeTab !== 'playing') && (
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            onClick={() => {
              setActiveSection('home');
              setActiveTab('playing');
            }}
            className="fixed bottom-[5.5rem] left-2 right-2 sm:left-4 sm:right-4 sm:bottom-28 sm:max-w-xl sm:mx-auto z-[80] bg-black/60 backdrop-blur-3xl border border-white/10 rounded-[1.5rem] p-2 flex items-center gap-3 shadow-[0_20px_50px_rgba(0,0,0,0.5)] active:scale-[0.98] transition-all cursor-pointer group/mini"
          >
            <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 shadow-lg relative group-hover/mini:scale-105 transition-transform duration-300">
              <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${audio.currentSong.coverArt})` || 'none', background: audio.currentSong.coverArt }} />
              {audio.isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <div className="flex gap-0.5 items-end h-3">
                    {[1,2,3,2].map((h, i) => (
                      <motion.div 
                        key={i}
                        animate={{ height: [`${h*4}px`, `${h*12}px`, `${h*4}px`] }}
                        transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                        className="w-0.5 bg-[#1DB954] rounded-full"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold truncate tracking-tight">{audio.currentSong.name}</h4>
              <p className="text-[9px] opacity-40 font-black tracking-[0.2em] truncate uppercase">{audio.currentSong.artist}</p>
            </div>

            <div className="flex items-center gap-1 pr-1">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFavorite(audio.currentSong!.id, e);
                }}
                className={`p-2.5 transition-all active:scale-125 ${favoriteIds.has(audio.currentSong.id) ? 'text-red-500' : 'text-white/20 hover:text-white/40'}`}
              >
                <Heart className={`w-5 h-5 ${favoriteIds.has(audio.currentSong.id) ? 'fill-current' : ''}`} />
              </button>
              
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  audio.togglePlay();
                }}
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white transition-all hover:bg-white/20 active:scale-95"
              >
                {audio.isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
              </button>
            </div>

            {/* Progress line */}
            <div className="absolute bottom-0 left-4 right-4 h-[1.5px] bg-white/5 rounded-full overflow-hidden">
               <motion.div 
                 className="h-full bg-[#1DB954] shadow-[0_0_8px_#1DB954]"
                 animate={{ width: `${(audio.progress / audio.duration) * 100}%` }}
               />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-[90] pb-safe">
        <div className="bg-black/80 backdrop-blur-3xl border-t border-white/5 px-6 py-4 flex items-center justify-around shadow-[0_-20px_40px_rgba(0,0,0,0.4)]">
          {[
            { id: 'home', icon: LayoutGrid, label: 'Vault' },
            { id: 'favorites', icon: Heart, label: 'Favs' },
            { id: 'playlists', icon: Library, label: 'Lists' },
            { id: 'settings', icon: User, label: 'Me' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveSection(item.id as any);
                if (item.id === 'home') {
                  setActiveTab('library');
                }
              }}
              className={`flex flex-col items-center gap-1.5 transition-all relative ${activeSection === item.id ? 'text-white' : 'text-white/30 hover:text-white/50'}`}
            >
              <div className={`p-2 rounded-2xl transition-all ${activeSection === item.id ? 'bg-white/10 scale-110 shadow-inner' : ''}`}>
                <item.icon className={`w-5 h-5 ${activeSection === item.id ? 'stroke-[2.5px]' : 'stroke-2'}`} />
              </div>
              <span className={`text-[9px] font-black uppercase tracking-[0.1em] transition-opacity ${activeSection === item.id ? 'opacity-100' : 'opacity-0'}`}>
                {item.label}
              </span>
              {activeSection === item.id && (
                <motion.div 
                  layoutId="nav-dot"
                  className="absolute -top-1 w-1 h-1 rounded-full bg-[#1DB954]"
                />
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Spacing for mobile nav */}
      <div className="h-24 sm:hidden" />

      {/* Upload Overlay */}
      {isUploading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-8">
           <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={() => setIsUploading(false)} />
           <motion.div 
             initial={{ scale: 0.9, opacity: 0 }}
             animate={{ scale: 1, opacity: 1 }}
             className="relative bg-white/5 border border-white/10 rounded-[3rem] p-12 max-w-lg w-full text-center space-y-6 overflow-hidden"
           >
              <div className="w-20 h-20 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-4">
                <Music className="w-10 h-10 text-purple-400" />
              </div>
              <h2 className="text-3xl font-bold">Add to your vault.</h2>
              <p className="opacity-40 text-sm">Every addition is a piece of your digital sanctuary.</p>
              
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="p-8 border-2 border-dashed border-white/10 rounded-3xl hover:border-purple-500/40 hover:bg-white/5 transition-all cursor-pointer"
              >
                <p className="font-bold opacity-60">Drop your file or <span className="text-purple-400 underline">browse</span></p>
              </div>

              <button 
                onClick={() => setIsUploading(false)}
                className="w-full py-4 rounded-2xl font-bold uppercase tracking-widest text-[10px] bg-white/5 hover:bg-white/10 transition-colors"
              >
                Close
              </button>
           </motion.div>
        </div>
      )}

      {/* Create Playlist Modal */}
      <AnimatePresence>
        {showCreatePlaylistModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreatePlaylistModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-[#1A1A1A] border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-2xl"
            >
              <h3 className="text-2xl font-bold mb-6">New Playlist</h3>
              <input 
                autoFocus
                type="text"
                placeholder="Playlist name..."
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newPlaylistName.trim()) {
                    const newPlaylist = {
                      id: Math.random().toString(36).substr(2, 9),
                      name: newPlaylistName.trim(),
                      songIds: [],
                      coverArt: generateProceduralArt(newPlaylistName),
                      createdAt: Date.now()
                    };
                    setPlaylists(prev => {
                      const updated = [...prev, newPlaylist];
                      db.playlists.add(newPlaylist);
                      return updated;
                    });
                    setSelectedPlaylistId(newPlaylist.id);
                    setNewPlaylistName("");
                    setShowCreatePlaylistModal(false);
                  }
                }}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-[#1DB954] transition-colors mb-6"
              />
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowCreatePlaylistModal(false)}
                  className="flex-1 py-3 rounded-full font-bold bg-white/5 hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  disabled={!newPlaylistName.trim()}
                  onClick={() => {
                    const newPlaylist = {
                      id: Math.random().toString(36).substr(2, 9),
                      name: newPlaylistName.trim(),
                      songIds: [],
                      coverArt: generateProceduralArt(newPlaylistName),
                      createdAt: Date.now()
                    };
                    setPlaylists(prev => {
                      const updated = [...prev, newPlaylist];
                      db.playlists.add(newPlaylist);
                      return updated;
                    });
                    setSelectedPlaylistId(newPlaylist.id);
                    setNewPlaylistName("");
                    setShowCreatePlaylistModal(false);
                  }}
                  className="flex-1 py-3 rounded-full font-bold bg-[#1DB954] hover:bg-[#1ed760] text-black transition-colors disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Song Modal */}
      <AnimatePresence>
        {songToEdit && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setSongToEdit(null)}
               className="absolute inset-0 bg-black/80 backdrop-blur-md"
             />
             <motion.div 
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.9, opacity: 0 }}
               className="relative bg-[#1A1A1A] border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-2xl"
             >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold">Edit Track Details</h3>
                  <div className="flex flex-col items-end gap-1">
                    <button 
                      onClick={handleMagicEnrich}
                      disabled={isEnriching}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full text-[10px] font-bold uppercase tracking-widest hover:scale-105 transition-all active:scale-95 disabled:opacity-50"
                    >
                      {isEnriching ? <Loader2 className="w-3 h-3 animate-spin"/> : <Sparkles className="w-3 h-3" />}
                      <span>AI Enrich</span>
                    </button>
                    <p className="text-[8px] opacity-30 uppercase tracking-tighter">Enter correct Track Name first</p>
                  </div>
                  <button onClick={() => setSongToEdit(null)} className="p-2 hover:bg-white/5 rounded-full"><X className="w-5 h-5"/></button>
                </div>
                <div className="space-y-4 max-h-[60vh] overflow-y-auto px-1">
                   <div>
                     <label className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-2 block">Track Name</label>
                     <div className="relative">
                        <input 
                          type="text"
                          value={songToEdit.name}
                          onChange={(e) => setSongToEdit({...songToEdit, name: e.target.value})}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-purple-500 outline-none"
                        />
                        <Wand2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-20" />
                     </div>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                     <div>
                       <label className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-2 block">Artist</label>
                       <input 
                         type="text"
                         value={songToEdit.artist}
                         onChange={(e) => setSongToEdit({...songToEdit, artist: e.target.value})}
                         className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-purple-500 outline-none"
                       />
                     </div>
                     <div>
                       <label className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-2 block">Album</label>
                       <input 
                         type="text"
                         value={songToEdit.album || ""}
                         onChange={(e) => setSongToEdit({...songToEdit, album: e.target.value})}
                         className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-purple-500 outline-none"
                       />
                     </div>
                   </div>
                   <div>
                     <label className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-2 block">Lyrics</label>
                     <textarea 
                       value={songToEdit.lyrics || ""}
                       onChange={(e) => setSongToEdit({...songToEdit, lyrics: e.target.value})}
                       placeholder="AI will fetch lyrics if you use the Enrich button above..."
                       className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-purple-500 outline-none h-32 resize-none text-sm leading-relaxed"
                     />
                   </div>
                   <div>
                     <label className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-2 block">Cover Art Preview</label>
                     <div className="w-full aspect-video rounded-xl overflow-hidden relative border border-white/10">
                        <div className="absolute inset-0" style={{ background: getCoverBackground(songToEdit.coverArt) }} />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                           <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Cover Generated</p>
                        </div>
                     </div>
                   </div>
                </div>
                <div className="flex gap-4 mt-8">
                   <button 
                     onClick={() => setSongToEdit(null)}
                     className="flex-1 py-3 rounded-full font-bold bg-white/5 hover:bg-white/10 transition-colors"
                   >
                     Cancel
                   </button>
                   <button 
                     onClick={() => songToEdit && updateSong(songToEdit)}
                     disabled={isEnriching}
                     className="flex-1 py-3 rounded-full font-bold bg-[#1DB954] hover:bg-[#1ed760] text-black transition-colors disabled:opacity-50"
                   >
                     {isEnriching ? 'AI Working...' : 'Save Changes'}
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add To Playlist Selector */}
      <AnimatePresence>
        {songToAddToPlaylist && (
          <div className="fixed inset-0 z-[111] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSongToAddToPlaylist(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="relative bg-[#1A1A1A] border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl overflow-hidden"
            >
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#1DB954]" />
                Add to Playlist
              </h3>
              <div className="max-h-[300px] overflow-y-auto pr-2 space-y-2 no-scrollbar">
                {playlists.length > 0 ? playlists.map(playlist => (
                  <button
                    key={playlist.id}
                    onClick={() => {
                      if (!playlist.songIds.includes(songToAddToPlaylist.id)) {
                        const updatedPlaylist = { ...playlist, songIds: [...playlist.songIds, songToAddToPlaylist.id] };
                        db.playlists.put(updatedPlaylist);
                        setPlaylists(prev => prev.map(p => 
                          p.id === playlist.id ? updatedPlaylist : p
                        ));
                      }
                      setSongToAddToPlaylist(null);
                    }}
                    className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors group text-left"
                  >
                    <div className="w-12 h-12 rounded-lg bg-white/5 flex-shrink-0">
                      <img src={playlist.coverArt} className="w-full h-full object-cover rounded-lg" alt="" />
                    </div>
                    <div>
                      <div className="font-medium group-hover:text-[#1DB954] transition-colors">{playlist.name}</div>
                      <div className="text-xs text-white/40">{playlist.songIds.length} songs</div>
                    </div>
                  </button>
                )) : (
                  <p className="text-sm text-white/40 text-center py-8 italic">No playlists created yet.</p>
                )}
              </div>
              <button 
                onClick={() => setSongToAddToPlaylist(null)}
                className="w-full mt-6 py-3 rounded-full font-bold bg-white/5 hover:bg-white/10 transition-colors"
              >
                Close
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Spotify Sync Overlay */}
      {showSyncOverlay && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-8">
           <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={() => !isTaskRunning && setShowSyncOverlay(false)} />
           <motion.div 
             initial={{ scale: 0.9, opacity: 0 }}
             animate={{ scale: 1, opacity: 1 }}
             className="relative bg-white/5 border border-white/10 rounded-[3rem] p-12 max-w-lg w-full text-center space-y-6 overflow-hidden"
           >
              <div className="w-20 h-20 rounded-full bg-[#1DB954]/20 flex items-center justify-center mx-auto mb-4">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="#1DB954"><path d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zm5.503 17.293c-.216.353-.674.464-1.026.248-2.855-1.745-6.448-2.138-10.68-1.17-.404.092-.81-.16-.902-.564-.092-.403.16-.81.564-.902 4.636-1.06 8.59-.61 11.796 1.347.353.216.464.674.248 1.026v.013zm1.47-3.255c-.272.443-.848.58-1.29.308-3.267-2.008-8.246-2.59-12.11-1.418-.497.151-1.02-.132-1.173-.628-.151-.497.132-1.02.628-1.173 4.417-1.34 9.904-.688 13.637 1.61.442.271.58.847.308 1.301zm.127-3.39c-3.92-2.327-10.37-2.542-14.127-1.403-.6.182-1.24-.162-1.423-.762-.182-.6.162-1.24.762-1.423 4.307-1.307 11.43-1.05 15.962 1.637.54.32.716 1.015.397 1.554s-1.015.716-1.554.397z"/></svg>
              </div>
              <h2 className="text-3xl font-bold">Sync from Spotify.</h2>
              <p className="opacity-40 text-sm">Paste a public playlist link to bridge your musical worlds.</p>
              
              <div className="space-y-4">
                {isTaskRunning ? (
                  <div className="space-y-6 py-8">
                     <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden relative">
                        <motion.div 
                          className="absolute inset-y-0 left-0 bg-[#1DB954] shadow-[0_0_15px_rgba(29,185,84,0.5)]"
                          animate={{ 
                            left: ['-100%', '100%'],
                            width: ['60%', '30%']
                          }}
                          transition={{ 
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut"
                          }}
                        />
                     </div>
                     <div className="space-y-2">
                        <motion.p 
                          key={syncStats ? 'stage-2' : 'stage-1'}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-xs font-black uppercase tracking-[0.3em] text-[#1DB954]"
                        >
                          {syncStats ? 'Encoding Tracks...' : 'Intercepting Spotify API...'}
                        </motion.p>
                        <p className="text-[10px] font-mono opacity-30 uppercase tracking-[0.2em]">
                          {syncStats ? 'Converting to high-fidelity audio streams' : 'Authenticating handshake and scraping metadata'}
                        </p>
                     </div>
                  </div>
                ) : syncStats ? (
                  <div className="space-y-4 py-8 text-center">
                    <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center shadow-[0_0_20px_rgba(34,197,94,0.4)]"
                      >
                        <svg className="w-6 h-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </motion.div>
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xl font-bold tracking-tight">Sync Complete!</h3>
                      <p className="text-[10px] opacity-40 uppercase tracking-[0.2em] font-black">
                        {syncStats.imported} of {syncStats.total} tracks imported
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <input 
                      type="text" 
                      placeholder="https://open.spotify.com/playlist/..." 
                      value={spotifyUrl}
                      onChange={(e) => setSpotifyUrl(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 outline-none focus:border-[#1DB954]/50 transition-colors text-center"
                    />
                    
                    {syncError && <p className="text-red-400 text-xs font-medium">{syncError}</p>}

                    <button 
                      type="button"
                      disabled={isTaskRunning || !spotifyUrl}
                      onClick={handleSpotifySync}
                      className="w-full py-4 bg-[#1DB954] hover:bg-[#1ed760] text-black rounded-2xl font-bold uppercase tracking-widest text-[11px] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Confirm Sync
                    </button>
                  </>
                )}
              </div>

              <button 
                type="button"
                disabled={isTaskRunning}
                onClick={() => setShowSyncOverlay(false)}
                className="w-full py-2 text-white/40 hover:text-white/60 transition-colors text-xs font-bold uppercase tracking-widest disabled:opacity-20"
              >
                Nevermind
              </button>
           </motion.div>
        </div>
      )}
    </div>
  );
}
