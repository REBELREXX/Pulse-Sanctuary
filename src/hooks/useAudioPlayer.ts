/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Song, PlaybackMode } from '../types';

export function useAudioPlayer(songs: Song[]) {
  const [currentSongIndex, setCurrentSongIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>(PlaybackMode.ORDER);
  const [queue, setQueue] = useState<number[]>([]);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const currentSong = currentSongIndex >= 0 ? songs[currentSongIndex] : null;

  // Initialize queue when songs length or mode changes
  useEffect(() => {
    if (songs.length === 0) {
      setQueue([]);
      return;
    }
    
    if (playbackMode === PlaybackMode.SHUFFLE) {
      const indices = Array.from({ length: songs.length }, (_, i) => i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      setQueue(indices);
    } else {
      setQueue(Array.from({ length: songs.length }, (_, i) => i));
    }
  }, [songs.length, playbackMode]);

  const togglePlay = useCallback(() => {
    if (currentSongIndex === -1) return;
    
    if (currentSong?.youtubeId) {
      // YouTube handled by ReactPlayer in UI, but we track state here
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
  }, [isPlaying, currentSongIndex, currentSong]);

  const playSong = useCallback((index: number) => {
    if (index === currentSongIndex) {
      if (currentSong?.youtubeId) {
        // Just toggle/reset handled in UI
        setIsPlaying(true);
      } else if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(console.error);
        setIsPlaying(true);
      }
    } else {
      setCurrentSongIndex(index);
      setIsPlaying(true);
      // If the incoming song is YouTube, ensure local audio stops
      if (songs[index]?.youtubeId && audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    }
  }, [currentSongIndex, currentSong, songs]);

  const nextSong = useCallback(() => {
    if (queue.length === 0) return;
    const currentQueueIndex = queue.indexOf(currentSongIndex);
    const nextIndex = (currentQueueIndex + 1) % queue.length;
    playSong(queue[nextIndex]);
  }, [queue, currentSongIndex, playSong]);

  const prevSong = useCallback(() => {
    if (queue.length === 0) return;
    const currentQueueIndex = queue.indexOf(currentSongIndex);
    const prevIndex = (currentQueueIndex - 1 + queue.length) % queue.length;
    playSong(queue[prevIndex]);
  }, [queue, currentSongIndex, playSong]);

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
      audioRef.current.src = currentSong.fileUrl;
      if (isPlaying) {
        audioRef.current.play().catch(console.error);
      }
    } else if (audioRef.current && currentSong?.youtubeId) {
       audioRef.current.pause();
       audioRef.current.src = '';
    }
  }, [currentSong]);

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
    currentSongIndex,
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
    seek,
    setVolume,
    setProgress, // Expose for external players (YouTube)
    setDuration, // Expose for external players (YouTube)
    setIsPlaying, // Expose for external players (YouTube)
  };
}
