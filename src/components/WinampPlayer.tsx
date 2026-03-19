import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, Search, Heart, Brain, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Visualizer from './Visualizer';
import RetroButton from './RetroButton';
import { Track, VisualizerMode } from '../types';
import { auth, signIn, signOut, db, handleFirestoreError, OperationType } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';

import ThinkingMode from './ThinkingMode';

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const WinampPlayer: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [volume, setVolume] = useState(0.5);
  const [vizMode, setVizMode] = useState<VisualizerMode>('spectrum');
  const [vizColor, setVizColor] = useState('#00ff00');
  const [fftSize, setFftSize] = useState(256);
  const [vizDensity, setVizDensity] = useState(10);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [playlistTab, setPlaylistTab] = useState<'search' | 'playlist' | 'connections'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isThinkingOpen, setIsThinkingOpen] = useState(false);
  const [isSpotifyConnected, setIsSpotifyConnected] = useState(false);
  const [isYouTubeConnected, setIsYouTubeConnected] = useState(false);
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);
  
  const SAMPLE_TRACKS: Track[] = [
    { id: '1', title: 'CYBERPUNK 2077', artist: 'HYPER', source: 'local', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
    { id: '2', title: 'RETRO FUTURE', artist: 'SYNTHWAVE', source: 'local', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
    { id: '3', title: 'NEON LIGHTS', artist: 'DREAMCORE', source: 'local', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
  ];

  const RETRO_PALETTE = [
    { name: 'Classic Green', color: '#00ff00' },
    { name: 'Cyberpunk Pink', color: '#ff00ff' },
    { name: 'Synthwave Blue', color: '#00ffff' },
    { name: 'Retro Orange', color: '#ff8800' },
    { name: 'Vaporwave Purple', color: '#8800ff' },
    { name: 'Matrix Green', color: '#00aa00' },
  ];

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setFavorites([]);
      setIsSettingsLoaded(false);
      return;
    }

    // Load Favorites
    const favPath = 'favorites';
    const q = query(collection(db, favPath), where('uid', '==', user.uid));
    const unsubscribeFavs = onSnapshot(q, (snapshot) => {
      setFavorites(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, favPath);
    });

    // Load Settings
    const settingsPath = `settings/${user.uid}`;
    const unsubscribeSettings = onSnapshot(doc(db, 'settings', user.uid), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.volume !== undefined) setVolume(data.volume);
        if (data.vizMode !== undefined) setVizMode(data.vizMode);
        if (data.vizColor !== undefined) setVizColor(data.vizColor);
        if (data.fftSize !== undefined) setFftSize(data.fftSize);
        if (data.vizDensity !== undefined) setVizDensity(data.vizDensity);
      }
      setIsSettingsLoaded(true);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, settingsPath);
    });

    return () => {
      unsubscribeFavs();
      unsubscribeSettings();
    };
  }, [user]);

  // Save Settings
  useEffect(() => {
    if (!user || !isSettingsLoaded) return;

    const saveSettings = async () => {
      const settingsPath = `settings/${user.uid}`;
      try {
        await setDoc(doc(db, 'settings', user.uid), {
          uid: user.uid,
          volume,
          vizMode,
          vizColor,
          fftSize,
          vizDensity,
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, settingsPath);
      }
    };

    const timeoutId = setTimeout(saveSettings, 1000); // Debounce saves
    return () => clearTimeout(timeoutId);
  }, [user, isSettingsLoaded, volume, vizMode, vizColor, fftSize, vizDensity]);

  // Check connection status
  useEffect(() => {
    if (!user) return;
    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/auth/status?userId=${user.uid}`);
        const data = await res.json();
        setIsSpotifyConnected(data.spotify);
        setIsYouTubeConnected(data.youtube);
      } catch (error) {
        console.error("Failed to check connection status:", error);
      }
    };
    checkStatus();
  }, [user]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SPOTIFY_AUTH_SUCCESS') {
        setIsSpotifyConnected(true);
      } else if (event.data?.type === 'YOUTUBE_AUTH_SUCCESS') {
        setIsYouTubeConnected(true);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    if (analyserRef.current) {
      analyserRef.current.fftSize = fftSize;
    }
  }, [fftSize]);

  const connectSpotify = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/auth/spotify/url?userId=${user.uid}`);
      const { url } = await res.json();
      window.open(url, 'spotify_auth', 'width=600,height=800');
    } catch (error) {
      console.error('Spotify auth error:', error);
    }
  };

  const connectYouTube = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/auth/youtube/url?userId=${user.uid}`);
      const { url } = await res.json();
      window.open(url, 'youtube_auth', 'width=600,height=800');
    } catch (error) {
      console.error('YouTube auth error:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchResults([]);
    try {
      const userIdParam = user ? `&userId=${user.uid}` : '';
      const [spotifyRes, youtubeRes] = await Promise.all([
        fetch(`/api/spotify/search?q=${encodeURIComponent(searchQuery)}${userIdParam}`),
        fetch(`/api/youtube/search?q=${encodeURIComponent(searchQuery)}${userIdParam}`)
      ]);

      const spotifyData = await spotifyRes.json();
      const youtubeData = await youtubeRes.json();

      const combined = [
        ...(spotifyData.tracks || []),
        ...(youtubeData.tracks || [])
      ];
      setSearchResults(combined);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const initAudio = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = fftSize;
      
      if (audioRef.current && !sourceRef.current) {
        sourceRef.current = audioContextRef.current.createMediaElementSource(audioRef.current);
        sourceRef.current.connect(analyserRef.current);
        analyserRef.current.connect(audioContextRef.current.destination);
      }
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  };

  const togglePlay = () => {
    initAudio();
    if (isPlaying) {
      audioRef.current?.pause();
    } else {
      audioRef.current?.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTrackSelect = (track: Track) => {
    if (track.source === 'youtube') {
      window.open(track.url, '_blank');
      return;
    }
    setCurrentTrack(track);
    setIsPlaying(true);
    if (audioRef.current) {
      audioRef.current.src = track.url || '';
      audioRef.current.play();
    }
  };

  const toggleFavorite = async () => {
    if (!user || !currentTrack) return;
    const existing = favorites.find(f => f.externalId === currentTrack.id);
    const favPath = 'favorites';
    try {
      if (existing) {
        await deleteDoc(doc(db, favPath, existing.id));
      } else {
        await addDoc(collection(db, favPath), {
          uid: user.uid,
          type: 'track',
          id: currentTrack.id,
          externalId: currentTrack.id,
          title: currentTrack.title,
          subtitle: currentTrack.artist,
          thumbnail: currentTrack.thumbnail || '',
          source: currentTrack.source,
          url: currentTrack.url || '',
          createdAt: serverTimestamp()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, favPath);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#111] text-[#00ff00] font-mono p-4">
      {/* Main Player Window */}
      <div className="w-full max-w-md bg-[#222] border-4 border-[#444] shadow-[8px_8px_0px_rgba(0,0,0,0.8)] overflow-hidden">
        {/* Title Bar */}
        <div className="flex items-center justify-between bg-gradient-to-r from-[#000080] to-[#1084d0] px-2 py-1 text-white text-xs font-bold select-none">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[#00ff00] rounded-full animate-pulse" />
            <span>RETROWAVE PLAYER v1.0</span>
          </div>
          <div className="flex gap-1">
            <div className="w-3 h-3 bg-[#ccc] border border-white" />
            <div className="w-3 h-3 bg-[#ccc] border border-white" />
            <div className="w-3 h-3 bg-[#ccc] border border-white" />
          </div>
        </div>

        {/* Display Area */}
        <div className="p-4 flex flex-col gap-4">
          <div className="flex gap-4 h-32">
            {/* Visualizer Section */}
            <div className="flex-1 relative group">
              <Visualizer analyser={analyserRef.current} mode={vizMode} color={vizColor} density={vizDensity} />
              <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 p-1 rounded">
                <div className="flex gap-1">
                  {['spectrum', 'oscilloscope', 'circles', 'plasma'].map(m => (
                    <button 
                      key={m}
                      onClick={() => setVizMode(m as VisualizerMode)}
                      className={cn("w-2 h-2 rounded-full border border-[#00ff00]", vizMode === m ? "bg-[#00ff00]" : "bg-transparent")}
                      title={m}
                    />
                  ))}
                </div>
                <div className="flex gap-1 flex-wrap max-w-[60px]">
                  {RETRO_PALETTE.map(p => (
                    <button 
                      key={p.color}
                      onClick={() => setVizColor(p.color)}
                      className={cn("w-2 h-2 rounded-full border", vizColor === p.color ? "border-white" : "border-transparent")}
                      style={{ backgroundColor: p.color }}
                      title={p.name}
                    />
                  ))}
                </div>
                
                {/* Fine-tuning controls */}
                <div className="flex flex-col gap-1 mt-1 border-t border-[#333] pt-1">
                  {(vizMode === 'spectrum' || vizMode === 'oscilloscope') && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[6px] text-[#00ff00] uppercase">FFT SIZE</span>
                      <input 
                        type="range"
                        min="5"
                        max="12"
                        step="1"
                        value={Math.log2(fftSize)}
                        onChange={(e) => setFftSize(Math.pow(2, parseInt(e.target.value)))}
                        className="w-full accent-[#00ff00] h-1 bg-[#222] appearance-none cursor-pointer"
                      />
                    </div>
                  )}
                  {vizMode === 'circles' && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[6px] text-[#00ff00] uppercase">DENSITY</span>
                      <input 
                        type="range"
                        min="1"
                        max="50"
                        step="1"
                        value={vizDensity}
                        onChange={(e) => setVizDensity(parseInt(e.target.value))}
                        className="w-full accent-[#00ff00] h-1 bg-[#222] appearance-none cursor-pointer"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Info Section */}
            <div className="w-32 flex flex-col justify-between text-[10px] bg-black p-2 border border-[#333]">
              <div>
                <div className="text-[#00ff00] truncate">{currentTrack?.title || 'NO TRACK'}</div>
                <div className="text-[#00aa00] truncate">{currentTrack?.artist || 'IDLE'}</div>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex justify-between">
                  <span>KBPS</span>
                  <span>192</span>
                </div>
                <div className="flex justify-between">
                  <span>KHZ</span>
                  <span>44.1</span>
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1">
              <RetroButton onClick={() => {}}><SkipBack size={12} /></RetroButton>
              <RetroButton onClick={togglePlay}>
                {isPlaying ? <Pause size={12} /> : <Play size={12} />}
              </RetroButton>
              <RetroButton onClick={() => {}}><SkipForward size={12} /></RetroButton>
            </div>
            
            <div className="flex-1 flex items-center gap-2 px-2 bg-black border border-[#333] h-8">
              <Volume2 size={12} />
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.01" 
                value={volume}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setVolume(v);
                  if (audioRef.current) audioRef.current.volume = v;
                }}
                className="flex-1 accent-[#00ff00] h-1 bg-[#222] appearance-none cursor-pointer"
              />
            </div>

            <div className="flex gap-1">
              <RetroButton 
                onClick={toggleFavorite} 
                variant={favorites.find(f => f.externalId === currentTrack?.id) ? 'primary' : 'secondary'}
              >
                <Heart size={12} fill={favorites.find(f => f.externalId === currentTrack?.id) ? '#00ff00' : 'none'} />
              </RetroButton>
              <RetroButton onClick={() => setShowPlaylist(!showPlaylist)}>
                <Menu size={12} />
              </RetroButton>
            </div>
          </div>
        </div>

        {/* Playlist / Search Area */}
        <AnimatePresence>
          {showPlaylist && (
            <motion.div 
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="border-t-2 border-[#444] bg-[#1a1a1a] overflow-hidden"
            >
              <div className="p-4 flex flex-col gap-4">
                {/* Tabs */}
                <div className="flex border-b border-[#333]">
                  <button 
                    onClick={() => setPlaylistTab('search')}
                    className={cn(
                      "flex-1 py-1 text-[10px] font-bold transition-colors",
                      playlistTab === 'search' ? "bg-[#333] text-[#00ff00]" : "text-[#444] hover:text-[#00aa00]"
                    )}
                  >
                    SEARCH
                  </button>
                  <button 
                    onClick={() => setPlaylistTab('playlist')}
                    className={cn(
                      "flex-1 py-1 text-[10px] font-bold transition-colors",
                      playlistTab === 'playlist' ? "bg-[#333] text-[#00ff00]" : "text-[#444] hover:text-[#00aa00]"
                    )}
                  >
                    MY PLAYLIST ({favorites.length})
                  </button>
                  <button 
                    onClick={() => setPlaylistTab('connections')}
                    className={cn(
                      "flex-1 py-1 text-[10px] font-bold transition-colors",
                      playlistTab === 'connections' ? "bg-[#333] text-[#00ff00]" : "text-[#444] hover:text-[#00aa00]"
                    )}
                  >
                    CONNECTIONS
                  </button>
                </div>

                {playlistTab === 'connections' && (
                  <div className="flex flex-col gap-2 p-2">
                    <div className="flex items-center justify-between bg-black border border-[#333] p-2">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", isSpotifyConnected ? "bg-[#1DB954]" : "bg-[#444]")} />
                        <span className="text-[10px] font-bold text-white">SPOTIFY</span>
                      </div>
                      <button 
                        onClick={connectSpotify}
                        className={cn(
                          "px-2 py-1 text-[8px] font-bold border",
                          isSpotifyConnected ? "border-[#1DB954] text-[#1DB954]" : "border-[#444] text-[#444] hover:border-[#00ff00] hover:text-[#00ff00]"
                        )}
                      >
                        {isSpotifyConnected ? 'CONNECTED' : 'CONNECT'}
                      </button>
                    </div>
                    <div className="flex items-center justify-between bg-black border border-[#333] p-2">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", isYouTubeConnected ? "bg-[#FF0000]" : "bg-[#444]")} />
                        <span className="text-[10px] font-bold text-white">YOUTUBE</span>
                      </div>
                      <button 
                        onClick={connectYouTube}
                        className={cn(
                          "px-2 py-1 text-[8px] font-bold border",
                          isYouTubeConnected ? "border-[#FF0000] text-[#FF0000]" : "border-[#444] text-[#444] hover:border-[#00ff00] hover:text-[#00ff00]"
                        )}
                      >
                        {isYouTubeConnected ? 'CONNECTED' : 'CONNECT'}
                      </button>
                    </div>
                    {!user && (
                      <p className="text-[8px] text-[#ff0000] text-center uppercase">Login required to save connections</p>
                    )}
                  </div>
                )}

                {playlistTab === 'search' ? (
                  <>
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        placeholder="SEARCH SPOTIFY / YOUTUBE..."
                        className="flex-1 bg-black border border-[#333] px-2 py-1 text-xs focus:outline-none focus:border-[#00ff00]"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      />
                      <RetroButton onClick={handleSearch} disabled={isSearching}>
                        {isSearching ? <div className="w-3 h-3 border border-[#00ff00] border-t-transparent rounded-full animate-spin" /> : <Search size={12} />}
                      </RetroButton>
                    </div>

                    <div className="max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-[#444] scrollbar-track-black">
                      {searchResults.length > 0 && (
                        <div className="p-2 text-[8px] text-[#444] uppercase border-b border-[#222]">Search Results</div>
                      )}
                      {searchResults.map((track) => (
                        <div 
                          key={track.id}
                          onClick={() => handleTrackSelect(track)}
                          className={cn(
                            "flex items-center justify-between p-2 hover:bg-[#333] cursor-pointer text-[10px] border-b border-[#222]",
                            currentTrack?.id === track.id && "bg-[#003300]"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span className={cn("text-[8px] px-1 rounded", track.source === 'spotify' ? "bg-[#1DB954] text-black" : "bg-[#FF0000] text-white")}>
                              {track.source === 'spotify' ? 'SPOT' : 'YOUT'}
                            </span>
                            <span className="truncate max-w-[150px]">{track.title} - {track.artist}</span>
                          </div>
                          {track.source === 'spotify' ? (
                            track.url ? <span className="text-[#00aa00]">PREVIEW</span> : <span className="text-[#444]">NO PREVIEW</span>
                          ) : (
                            <span className="text-[#00aa00]">LINK</span>
                          )}
                        </div>
                      ))}

                      <div className="p-2 text-[8px] text-[#444] uppercase border-b border-[#222]">Sample Tracks</div>
                      {SAMPLE_TRACKS.map((track) => (
                        <div 
                          key={track.id}
                          onClick={() => handleTrackSelect(track)}
                          className={cn(
                            "flex items-center justify-between p-2 hover:bg-[#333] cursor-pointer text-[10px] border-b border-[#222]",
                            currentTrack?.id === track.id && "bg-[#003300]"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-[#00aa00]">{track.id.padStart(2, '0')}.</span>
                            <span>{track.title} - {track.artist}</span>
                          </div>
                          <span className="text-[#00aa00]">4:20</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-[#444] scrollbar-track-black">
                    {favorites.length === 0 ? (
                      <div className="p-8 text-center text-[10px] text-[#444]">
                        YOUR PLAYLIST IS EMPTY.<br/>HEART SOME TRACKS TO ADD THEM HERE.
                      </div>
                    ) : (
                      favorites.map((fav) => (
                        <div 
                          key={fav.id}
                          onClick={() => handleTrackSelect({ id: fav.externalId, title: fav.title, artist: fav.subtitle || '', source: fav.source || 'spotify', url: fav.url })}
                          className={cn(
                            "flex items-center justify-between p-2 hover:bg-[#333] cursor-pointer text-[10px] border-b border-[#222]",
                            currentTrack?.id === fav.externalId && "bg-[#003300]"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <Heart size={8} className="text-[#00ff00]" fill="#00ff00" />
                            <span className={cn("text-[8px] px-1 rounded", fav.source === 'spotify' ? "bg-[#1DB954] text-black" : "bg-[#FF0000] text-white")}>
                              {fav.source === 'spotify' ? 'SPOT' : 'YOUT'}
                            </span>
                            <span className="truncate max-w-[150px]">{fav.title} - {fav.subtitle}</span>
                          </div>
                          <button 
                            onClick={async (e) => {
                              e.stopPropagation();
                              const favPath = `favorites/${fav.id}`;
                              try {
                                await deleteDoc(doc(db, 'favorites', fav.id));
                              } catch (error) {
                                handleFirestoreError(error, OperationType.DELETE, favPath);
                              }
                            }}
                            className="text-[#444] hover:text-red-500"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status Bar */}
        <div className="bg-[#ccc] text-black text-[9px] px-2 py-0.5 flex justify-between border-t border-white">
          <div className="flex gap-4">
            <span>{user ? `LOGGED IN: ${user.email}` : 'GUEST MODE'}</span>
            <span>{isPlaying ? 'PLAYING' : 'STOPPED'}</span>
          </div>
          <div className="flex gap-2">
            {!isSpotifyConnected && (
              <button onClick={connectSpotify} className="hover:underline text-[#1DB954]">CONNECT SPOTIFY</button>
            )}
            {!user ? (
              <button onClick={signIn} className="hover:underline">LOGIN</button>
            ) : (
              <button onClick={signOut} className="hover:underline">LOGOUT</button>
            )}
          </div>
        </div>
      </div>

      {/* Hidden Audio Element */}
      <audio ref={audioRef} crossOrigin="anonymous" onEnded={() => setIsPlaying(false)} />

      {/* AI Genius Trigger */}
      <div className="mt-8">
        <RetroButton className="flex items-center gap-2 py-2 px-4" onClick={() => setIsThinkingOpen(true)}>
          <Brain size={16} />
          <span>GENIUS THINKING MODE</span>
        </RetroButton>
      </div>

      <ThinkingMode 
        isOpen={isThinkingOpen} 
        onClose={() => setIsThinkingOpen(false)} 
        currentTrack={currentTrack} 
      />
    </div>
  );
};

export default WinampPlayer;
