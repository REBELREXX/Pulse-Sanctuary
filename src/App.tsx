/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from 'motion/react';
import React, { useState, useRef, useEffect } from 'react';
import ReactPlayer from 'react-player';

const Player = ReactPlayer as any;
import { 
  Play, Pause, SkipBack, SkipForward, 
  Plus, Search, MoreHorizontal, ListMusic, 
  Settings, User, Music, Shuffle, Repeat, Volume2 
} from 'lucide-react';
import Background from './components/Background';
import Visualizer from './components/Visualizer';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { Song, Playlist, PlaybackMode } from './types';
import { generateProceduralArt, getAccentColor } from './utils/proceduralArt';

/**
 * Cockpit component for playback controls
 */
function PlayCockpit({ audio, activeTab }: { audio: any, activeTab: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 backdrop-blur-md relative overflow-hidden group">
      <div 
        className="absolute inset-0 opacity-10 blur-[60px] pointer-events-none transition-all duration-700"
        style={{ background: audio.currentSong ? audio.currentSong.coverArt : 'transparent' }}
      />
      <div className="relative z-10 space-y-8">
        {activeTab === 'library' && (
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl overflow-hidden">
              <div className="w-full h-full" style={{ background: audio.currentSong?.coverArt || 'rgba(255,255,255,0.05)' }} />
            </div>
            <div>
              <h4 className="font-bold line-clamp-1">{audio.currentSong?.name || 'No Track'}</h4>
              <p className="text-[10px] uppercase tracking-widest font-bold opacity-40">{audio.currentSong?.artist || 'Select a song'}</p>
            </div>
          </div>
        )}
        <div className="space-y-2">
          <div className="flex justify-between text-[10px] font-mono opacity-40">
            <span>{Math.floor(audio.progress / 60)}:{Math.floor(audio.progress % 60).toString().padStart(2, '0')}</span>
            <span>{audio.duration ? `${Math.floor(audio.duration / 60)}:${Math.floor(audio.duration % 60).toString().padStart(2, '0')}` : '--:--'}</span>
          </div>
          <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden cursor-pointer group/progress relative" onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const pct = x / rect.width;
            if (audio.duration) audio.seek(pct * audio.duration);
          }}>
            <motion.div 
              className="h-full bg-white relative"
              initial={{ width: 0 }}
              animate={{ width: `${audio.duration ? (audio.progress / audio.duration) * 100 : 0}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-[0_0_8px_white] scale-0 group-hover/progress:scale-100 transition-transform" />
            </motion.div>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <button 
            onClick={() => audio.setPlaybackMode(audio.playbackMode === PlaybackMode.SHUFFLE ? PlaybackMode.ORDER : PlaybackMode.SHUFFLE)}
            className={`p-2 transition-all ${audio.playbackMode === PlaybackMode.SHUFFLE ? 'text-purple-400' : 'opacity-40 hover:opacity-100'}`}
          >
            <Shuffle className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-6">
            <button onClick={audio.prevSong} className="p-2 opacity-60 hover:opacity-100 active:scale-90 transition-all">
              <SkipBack className="w-6 h-6 fill-white" />
            </button>
            <button 
              onClick={audio.togglePlay}
              className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]"
            >
              {audio.isPlaying ? <Pause className="w-8 h-8 fill-black" /> : <Play className="w-8 h-8 fill-black ml-1" />}
            </button>
            <button onClick={audio.nextSong} className="p-2 opacity-60 hover:opacity-100 active:scale-90 transition-all">
              <SkipForward className="w-6 h-6 fill-white" />
            </button>
          </div>
          <button className="p-2 opacity-40 hover:opacity-100 transition-all">
            <Repeat className="w-5 h-5" />
          </button>
        </div>
        <div className="pt-4 border-t border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 max-w-[150px]">
            <Volume2 className="w-4 h-4 opacity-40" />
            <input 
              type="range" 
              min="0" max="1" step="0.01" 
              value={audio.volume}
              onChange={(e) => audio.setVolume(parseFloat(e.target.value))}
              className="w-full accent-white opacity-40 hover:opacity-100 transition-opacity"
            />
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => audio.setPlaybackMode(PlaybackMode.ORDER)}
              className={`text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border transition-all ${audio.playbackMode === PlaybackMode.ORDER ? 'border-purple-500 bg-purple-500/20 text-white' : 'border-white/10 text-white/40'}`}
            >
              Ordered
            </button>
            <button 
              onClick={() => audio.setPlaybackMode(PlaybackMode.SHUFFLE)}
              className={`text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border transition-all ${audio.playbackMode === PlaybackMode.SHUFFLE ? 'border-purple-500 bg-purple-500/20 text-white' : 'border-white/10 text-white/40'}`}
            >
              Shuffle
            </button>
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
  
  const effectiveSongs = playingPlaylistId 
    ? songs.filter(s => playlists.find(p => p.id === playingPlaylistId)?.songIds.includes(s.id))
    : songs;

  const audio = useAudioPlayer(effectiveSongs);
  const playerRef = useRef<any>(null);

  // Persistence: Load data on mount
  useEffect(() => {
    try {
      const savedSongs = localStorage.getItem('vault_songs');
      const savedPlaylists = localStorage.getItem('vault_playlists');
      const savedFavorites = localStorage.getItem('vault_favorites');

      if (savedSongs) {
        const parsed = JSON.parse(savedSongs);
        if (Array.isArray(parsed)) setSongs(parsed);
      }
      if (savedPlaylists) {
        const parsed = JSON.parse(savedPlaylists);
        if (Array.isArray(parsed)) setPlaylists(parsed);
      }
      if (savedFavorites) {
        const parsed = JSON.parse(savedFavorites);
        if (Array.isArray(parsed)) setFavoriteIds(new Set(parsed));
      }
    } catch (e) {
      console.error("Failed to load library from storage", e);
    }
  }, []);

  // Persistence: Save data on changes
  useEffect(() => {
    if (songs.length > 0) {
      localStorage.setItem('vault_songs', JSON.stringify(songs));
    }
  }, [songs]);

  useEffect(() => {
    if (playlists.length > 0) {
      localStorage.setItem('vault_playlists', JSON.stringify(playlists));
    }
  }, [playlists]);

  useEffect(() => {
    localStorage.setItem('vault_favorites', JSON.stringify(Array.from(favoriteIds)));
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

  const handleSpotifySync = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!spotifyUrl) return;
    setIsTaskRunning(true);
    setSyncError('');

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
        duration: 0,
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

      // Use functional state updates to ensure consistency
      setSongs(prev => {
        const existingIds = new Set(prev.map(s => s.id));
        const filteredNew = importedSongs.filter(s => !existingIds.has(s.id));
        return [...prev, ...filteredNew];
      });
      
      setPlaylists(prev => [...prev, newPlaylist]);
      setShowSyncOverlay(false);
      setIsTaskRunning(false);
      setSpotifyUrl('');
    } catch (error: any) {
      console.error('Sync failed:', error);
      setSyncError(error.message || 'Failed to sync. Please ensure the link is a valid public Spotify playlist.');
      setIsTaskRunning(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const name = file.name.replace(/\.[^/.]+$/, "");
    const url = URL.createObjectURL(file);
    
    const newSong: Song = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      artist: 'Unknown Artist',
      duration: 0, // Would need metadata parsing for real duration
      fileUrl: url,
      coverArt: generateProceduralArt(name),
      addedAt: Date.now(),
    };

    setSongs([...songs, newSong]);
    setIsUploading(false);
  };

  const selectedPlaylist = playlists.find(p => p.id === selectedPlaylistId);
  const playlistSongs = selectedPlaylist ? songs.filter(s => selectedPlaylist.songIds.includes(s.id)) : [];

  const filteredSongs = songs.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const playPlaylistSong = (songId: string) => {
    setPlayingPlaylistId(selectedPlaylistId);
    // The delay ensures the audio player re-initializes with the new songs array before we try to set index
    setTimeout(() => {
      const activeSongs = selectedPlaylistId 
        ? songs.filter(s => playlists.find(p => p.id === selectedPlaylistId)?.songIds.includes(s.id))
        : songs;
      const index = activeSongs.findIndex(s => s.id === songId);
      if (index !== -1) audio.playSong(index);
    }, 0);
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

      <main className="max-w-7xl mx-auto px-8 pt-32 pb-32">
        <AnimatePresence mode="wait">
          {activeSection === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {/* 2. Hero Section */}
              <div className="mb-12">
                <motion.h1 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-5xl font-medium mb-4 tracking-tight"
                >
                  Welcome to your curated sanctuary.
                </motion.h1>
                <motion.p 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-white/40 text-sm tracking-wide uppercase font-bold"
                >
                  {songs.length} tracks across {playlists.length} playlists
                </motion.p>
              </div>

              {/* 3. Central Command Center */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-12 xl:col-span-8">
                  <div className="mb-6 flex gap-4">
                    <button 
                      onClick={() => setActiveTab('library')}
                      className={`text-sm font-bold uppercase tracking-widest pb-2 border-b-2 transition-all ${activeTab === 'library' ? 'border-purple-500 text-white' : 'border-transparent text-white/30'}`}
                    >
                      Library
                    </button>
                    <button 
                      onClick={() => setActiveTab('playing')}
                      className={`text-sm font-bold uppercase tracking-widest pb-2 border-b-2 transition-all ${activeTab === 'playing' ? 'border-purple-500 text-white' : 'border-transparent text-white/30'}`}
                    >
                      Now Playing
                    </button>
                  </div>

                  <AnimatePresence mode="wait">
                    {activeTab === 'library' ? (
                      <motion.div 
                        key="library"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="space-y-6"
                      >
                        {/* Search & Add */}
                        <div className="flex gap-4">
                          <div className="relative flex-1">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
                            <input 
                              type="text" 
                              placeholder="Search your sanctuary..." 
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-purple-500/50 transition-colors"
                            />
                          </div>
                          <button 
                            onClick={() => setIsUploading(true)}
                            className="bg-white text-black px-6 rounded-2xl font-bold flex items-center gap-2 hover:bg-white/90 active:scale-95 transition-all"
                          >
                            <Plus className="w-5 h-5" />
                            <span>Add New</span>
                          </button>
                          <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept="audio/*" 
                            onChange={handleFileUpload}
                          />
                        </div>

                        {/* Song List */}
                        <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
                          {filteredSongs.length > 0 ? (
                            <div className="divide-y divide-white/5">
                              {filteredSongs.map((song) => (
                                <div 
                                  key={song.id} 
                                  onClick={() => audio.playSong(songs.indexOf(song))}
                                  className="group flex items-center gap-4 p-4 hover:bg-white/5 cursor-pointer transition-all active:scale-[0.99]"
                                >
                                  <div className="w-12 h-12 rounded-xl overflow-hidden relative flex-shrink-0 shadow-lg">
                                     <div className="absolute inset-0" style={{ background: song.coverArt }} />
                                     <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors">
                                        <Play className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity fill-white" />
                                     </div>
                                     {audio.currentSong?.id === song.id && audio.isPlaying && (
                                       <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                         <div className="flex gap-1">
                                            {[1,2,3].map(i => (
                                              <motion.div 
                                                key={i}
                                                animate={{ height: [8, 16, 8] }}
                                                transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                                                className="w-1 bg-white rounded-full"
                                              />
                                            ))}
                                         </div>
                                       </div>
                                     )}
                                  </div>
                                  <div className="flex-1">
                                    <h4 className={`font-medium ${audio.currentSong?.id === song.id ? 'text-purple-400' : 'text-white'}`}>{song.name}</h4>
                                    <p className="text-xs text-white/40 uppercase tracking-widest font-bold">{song.artist}</p>
                                  </div>
                                  <button 
                                    onClick={(e) => toggleFavorite(song.id, e)}
                                    className={`p-2 transition-colors ${favoriteIds.has(song.id) ? 'text-red-400' : 'text-white/20 hover:text-white/40'}`}
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill={favoriteIds.has(song.id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                                  </button>
                                  <span className="text-xs text-white/30 font-mono w-12 text-right">--:--</span>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSongToAddToPlaylist(song);
                                    }}
                                    className="p-2 opacity-0 group-hover:opacity-100 transition-opacity hover:text-[#1DB954]"
                                    title="Add to Playlist"
                                  >
                                    <ListMusic className="w-5 h-5 opacity-60 group-hover:opacity-100" />
                                  </button>
                                  <button className="p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <MoreHorizontal className="w-5 h-5 opacity-40" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="py-20 flex flex-col items-center opacity-30 gap-4">
                              <Music className="w-12 h-12" />
                              <p className="text-sm font-bold uppercase tracking-widest">No tracks in your sanctuary yet.</p>
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
                        <div className="aspect-square max-w-[400px] mx-auto rounded-[3rem] overflow-hidden relative shadow-2xl shadow-black/50 group">
                          <div 
                            className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 group-hover:scale-110" 
                            style={{ background: audio.currentSong?.coverArt || 'rgba(255,255,255,0.05)' }} 
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                          
                          <div className="absolute bottom-12 left-12 right-12 text-center">
                             <h2 className="text-3xl font-bold mb-2 tracking-tight">
                               {audio.currentSong?.name || 'Nothing playing'}
                             </h2>
                             <p className="text-sm text-white/60 uppercase tracking-[0.2em] font-bold">
                               {audio.currentSong?.artist || '--'}
                             </p>
                          </div>
                        </div>

                        <Visualizer 
                          isPlaying={audio.isPlaying} 
                          accentColor={audio.currentSong ? getAccentColor(audio.currentSong.name) : '#a855f7'} 
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* 4. Controls Cockpit Container moved inside sections if needed, but keeping it sticky for home */}
                <div className="lg:col-span-12 xl:col-span-4 sticky top-32">
                  <PlayCockpit audio={audio} activeTab={activeTab} />
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
                       onClick={() => audio.playSong(songs.indexOf(song))}
                       className="group flex items-center gap-4 p-4 hover:bg-white/5 cursor-pointer transition-all"
                     >
                       <div className="w-12 h-12 rounded-xl overflow-hidden" style={{ background: song.coverArt }} />
                       <div className="flex-1">
                         <h4 className="font-medium">{song.name}</h4>
                         <p className="text-xs opacity-40 uppercase tracking-widest font-bold">{song.artist}</p>
                       </div>
                       <button onClick={(e) => toggleFavorite(song.id, e)} className="text-red-400 p-2">
                         <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                       </button>
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
                     <div className="max-w-4xl mx-auto">
                        <div className="flex flex-col md:flex-row gap-8 mb-12 items-center md:items-end">
                           <div className="w-64 h-64 rounded-[3rem] shadow-2xl flex-shrink-0" style={{ background: selectedPlaylist.coverArt }} />
                           <div className="flex-1 text-center md:text-left">
                              <p className="text-xs font-bold uppercase tracking-[0.4em] opacity-40 mb-2">Playlist</p>
                              <h1 className="text-6xl font-bold mb-6 tracking-tighter">{selectedPlaylist.name}</h1>
                              <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                                 <button 
                                   onClick={() => playPlaylistSong(selectedPlaylist.songIds[0])}
                                   className="bg-white text-black px-8 py-3 rounded-full font-bold uppercase tracking-widest flex items-center gap-2 hover:scale-105 active:scale-95 transition-all"
                                 >
                                    <Play className="w-5 h-5 fill-black" />
                                    Play All
                                 </button>
                                 <button 
                                   onClick={() => {
                                      audio.setPlaybackMode(PlaybackMode.SHUFFLE);
                                      playPlaylistSong(selectedPlaylist.songIds[Math.floor(Math.random() * selectedPlaylist.songIds.length)]);
                                   }}
                                   className="bg-white/10 px-8 py-3 rounded-full font-bold uppercase tracking-widest flex items-center gap-2 border border-white/10 hover:bg-white/20 transition-all"
                                 >
                                    <Shuffle className="w-5 h-5" />
                                    Shuffle
                                 </button>
                                 <button 
                                   onClick={() => setSelectedPlaylistId(null)}
                                   className="px-8 py-3 rounded-full font-bold uppercase tracking-widest text-white/40 hover:text-white transition-all"
                                 >
                                   Back
                                 </button>
                              </div>
                           </div>
                        </div>

                        <div className="bg-white/5 rounded-[3rem] border border-white/10 overflow-hidden mb-20">
                           <div className="divide-y divide-white/5">
                              {playlistSongs.length > 0 ? playlistSongs.map((song, i) => (
                                <div 
                                  key={song.id}
                                  onClick={() => playPlaylistSong(song.id)}
                                  className="group flex items-center gap-4 p-4 hover:bg-white/5 cursor-pointer transition-all"
                                >
                                   <span className="w-8 text-xs font-mono opacity-20 text-center font-bold">{i + 1}</span>
                                   <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0" style={{ background: song.coverArt }} />
                                   <div className="flex-1 min-w-0">
                                      <h4 className={`font-medium truncate ${audio.currentSong?.id === song.id ? 'text-purple-400' : 'text-white'}`}>{song.name}</h4>
                                      <p className="text-[10px] opacity-30 uppercase tracking-widest font-bold truncate">{song.artist}</p>
                                   </div>
                                   <button 
                                     onClick={(e) => toggleFavorite(song.id, e)}
                                     className={`p-2 transition-colors ${favoriteIds.has(song.id) ? 'text-red-400' : 'text-white/20 hover:text-white/40'}`}
                                   >
                                     <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill={favoriteIds.has(song.id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                                   </button>
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
              className="space-y-8"
            >
              <h2 className="text-4xl font-bold">Settings</h2>
              <div className="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-6">
                 <div>
                   <h4 className="text-sm font-bold uppercase tracking-widest text-purple-400 mb-4">Account</h4>
                   <div className="p-4 bg-white/5 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center"><User /></div>
                        <div>
                          <p className="font-bold">Premium Owner</p>
                          <p className="text-xs opacity-40">Exclusive Access</p>
                        </div>
                      </div>
                      <button className="text-xs font-bold uppercase tracking-widest underline">Edit Profile</button>
                   </div>
                 </div>
                 <div>
                    <h4 className="text-sm font-bold uppercase tracking-widest text-purple-400 mb-4">Audio Engine</h4>
                    <p className="text-sm opacity-60">High-fidelity 32-bit floating point processing enabled.</p>
                 </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-4 sm:bottom-8 left-1/2 -translate-x-1/2 z-[90] px-4 w-full sm:w-auto">
        <div className="bg-black/60 backdrop-blur-2xl border border-white/10 rounded-full p-1.5 sm:p-2 flex items-center justify-between sm:justify-center gap-1 shadow-2xl shadow-black/50 overflow-x-auto no-scrollbar">
          {[
            { id: 'home', icon: Music, label: 'Home' },
            { id: 'favorites', icon: (props: any) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>, label: 'Vault' },
            { id: 'playlists', icon: ListMusic, label: 'Lists' },
            { id: 'settings', icon: Settings, label: 'Sys' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id as any)}
              className={`relative px-4 sm:px-6 py-2.5 sm:py-3 rounded-full flex items-center gap-2 transition-all group shrink-0 ${activeSection === item.id ? 'text-white' : 'text-white/40 hover:text-white/60'}`}
            >
              <item.icon className="w-4 h-4 sm:w-5 sm:h-5" />
              <AnimatePresence>
                {activeSection === item.id && (
                  <motion.span 
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 'auto', opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    className="text-[10px] sm:text-xs font-bold uppercase tracking-widest overflow-hidden whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
              {activeSection === item.id && (
                <motion.div 
                  layoutId="nav-pill"
                  className="absolute inset-0 bg-white/10 rounded-full -z-10"
                />
              )}
            </button>
          ))}
        </div>
      </nav>

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
                    setPlaylists(prev => [...prev, newPlaylist]);
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
                    setPlaylists(prev => [...prev, newPlaylist]);
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
                        setPlaylists(prev => prev.map(p => 
                          p.id === playlist.id 
                            ? { ...p, songIds: [...p.songIds, songToAddToPlaylist.id] }
                            : p
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
                  <div className="space-y-4 py-8">
                     <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden relative">
                        <motion.div 
                          className="absolute inset-y-0 left-0 bg-[#1DB954]"
                          animate={{ 
                            left: ['-100%', '100%'],
                            width: ['50%', '20%']
                          }}
                          transition={{ 
                            duration: 1.5,
                            repeat: Infinity,
                            ease: "easeInOut"
                          }}
                        />
                     </div>
                     <p className="text-xs font-mono opacity-40 uppercase tracking-widest">Bridging Musical Realms...</p>
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
                      {isTaskRunning ? 'Syncing...' : 'Confirm Sync'}
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
