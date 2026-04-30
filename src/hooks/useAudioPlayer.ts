/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Song, PlaybackMode } from '../types';

export function useAudioPlayer(songs: Song[]) {
  const [currentSongId, setCurrentSongId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>(PlaybackMode.ORDER);
  const [queue, setQueue] = useState<string[]>([]);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const currentSong = songs.find(s => s.id === currentSongId) || null;

  // Initialize queue when pool of songs changes significantly
  useEffect(() => {
    if (songs.length === 0) {
      setQueue([]);
      return;
    }
    
    // Only auto-initialize if queue is empty or if we specifically want to sync with songs
    if (queue.length === 0) {
      const ids = songs.map(s => s.id);
      if (playbackMode === PlaybackMode.SHUFFLE) {
        for (let i = ids.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [ids[i], ids[j]] = [ids[j], ids[i]];
        }
      }
      setQueue(ids);
      // Set initial song if none playing
      if (!currentSongId && ids.length > 0) {
        setCurrentSongId(ids[0]);
      }
    }
  }, [songs, playbackMode]);

  const togglePlay = useCallback(() => {
    if (!currentSongId) return;
    
    if (currentSong?.youtubeId) {
      setIsPlaying(!isPlaying);
      if (audioRef.current) audioRef.current.pause();
    } else {
      if (!audioRef.current) return;
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(console.error);
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying, currentSongId, currentSong]);

  const playSong = useCallback((id: string) => {
    if (id === currentSongId) {
      if (currentSong?.youtubeId) {
        setIsPlaying(true);
      } else if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(console.error);
        setIsPlaying(true);
      }
    } else {
      setCurrentSongId(id);
      setIsPlaying(true);
      const song = songs.find(s => s.id === id);
      if (song?.youtubeId && audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    }
  }, [currentSongId, currentSong, songs]);

  const nextSong = useCallback(() => {
    if (queue.length === 0) return;
    const currentIndex = queue.indexOf(currentSongId || '');
    if (currentIndex === -1) {
      playSong(queue[0]);
    } else {
      const nextIndex = (currentIndex + 1) % queue.length;
      playSong(queue[nextIndex]);
    }
  }, [queue, currentSongId, playSong]);

  const prevSong = useCallback(() => {
    if (queue.length === 0) return;
    const currentIndex = queue.indexOf(currentSongId || '');
    if (currentIndex === -1) {
      playSong(queue[queue.length - 1]);
    } else {
      const prevIndex = (currentIndex - 1 + queue.length) % queue.length;
      playSong(queue[prevIndex]);
    }
  }, [queue, currentSongId, playSong]);

  const addToQueue = (id: string) => {
    setQueue(prev => [...prev, id]);
  };

  const removeFromQueue = (index: number) => {
    setQueue(prev => prev.filter((_, i) => i !== index));
  };

  const moveInQueue = (from: number, to: number) => {
    setQueue(prev => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  // Handle actual audio element
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const audio = audioRef.current;

    const handleTimeUpdate = () => {
      if (!currentSong?.youtubeId) setProgress(audio.currentTime);
    };
    const handleDurationChange = () => {
      if (!currentSong?.youtubeId) setDuration(audio.duration);
    };
    const handleEnded = () => nextSong();

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [nextSong, currentSong]);

  useEffect(() => {
    if (audioRef.current && currentSong && !currentSong.youtubeId) {
      if (currentSong.fileUrl && audioRef.current.src !== currentSong.fileUrl) {
        audioRef.current.src = currentSong.fileUrl;
        audioRef.current.load();
      } else if (!currentSong.fileUrl) {
        audioRef.current.removeAttribute('src');
        audioRef.current.load();
      }

      if (isPlaying && currentSong.fileUrl) {
        audioRef.current.play().catch((err) => {
          if (err.name !== 'AbortError') console.error("Playback failed", err);
        });
      }
    } else if (audioRef.current && currentSong?.youtubeId) {
       audioRef.current.pause();
       audioRef.current.removeAttribute('src');
       audioRef.current.load();
    }
  }, [currentSong, isPlaying]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const seek = (time: number) => {
    if (currentSong?.youtubeId) {
      // Handled by ref in UI, but we update progress to keep UI snappy
      setProgress(time);
    } else if (audioRef.current) {
      audioRef.current.currentTime = time;
      setProgress(time);
    }
  };

  return {
    currentSong,
    currentSongId,
    queue,
    isPlaying,
    progress,
    duration,
    volume,
    playbackMode,
    setPlaybackMode,
    togglePlay,
    playSong,
    nextSong,
    prevSong,
    addToQueue,
    removeFromQueue,
    moveInQueue,
    setQueue,
    seek,
    setVolume,
    setProgress, // Expose for external players (YouTube)
    setDuration, // Expose for external players (YouTube)
    setIsPlaying, // Expose for external players (YouTube)
  };
}
