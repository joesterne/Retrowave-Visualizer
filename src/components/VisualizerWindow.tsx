import React, { useEffect, useRef, useState } from 'react';
import { VisualizerMode } from '../types';

const RETRO_PALETTE = [
  { name: 'Classic Green', color: '#00ff00' },
  { name: 'Cyberpunk Pink', color: '#ff00ff' },
  { name: 'Synthwave Blue', color: '#00ffff' },
  { name: 'Retro Orange', color: '#ff8800' },
  { name: 'Vaporwave Purple', color: '#8800ff' },
];

const VisualizerWindow: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<VisualizerMode>('spectrum');
  const [color, setColor] = useState('#00ff00');
  const [density, setDensity] = useState(10);
  
  const [overrideMode, setOverrideMode] = useState<VisualizerMode | null>(null);
  const [overrideColor, setOverrideColor] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'VIZ_DATA') {
        const { data, mode: m, color: c, density: d } = event.data;
        if (m && !overrideMode) setMode(m);
        if (c && !overrideColor) setColor(c);
        if (d) setDensity(d);
        
        draw(data);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [overrideMode, overrideColor]);

  const activeMode = overrideMode || mode;
  const activeColor = overrideColor || color;

  const draw = (data: Uint8Array) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    if (activeMode === 'spectrum' || activeMode === 'bars') {
      const barWidth = (width / data.length) * (activeMode === 'bars' ? 2.5 : 1);
      let x = 0;
      for (let i = 0; i < data.length; i++) {
        const barHeight = (data[i] / 255) * height;
        ctx.fillStyle = activeColor;
        ctx.fillRect(x, height - barHeight, barWidth - (activeMode === 'bars' ? 1 : 0), barHeight);
        x += barWidth;
      }
    } else if (activeMode === 'dots') {
      const dotSpacing = Math.max(2, Math.floor(100 / density));
      const maxDots = Math.floor(width / dotSpacing);
      let x = 0;
      for (let i = 0; i < maxDots && i < data.length; i++) {
        const v = data[i] / 255;
        const y = height - (v * height);
        ctx.beginPath();
        ctx.arc(x, y, dotSpacing / 2, 0, 2 * Math.PI);
        ctx.fillStyle = activeColor;
        ctx.fill();
        x += dotSpacing + 2;
      }
    } else if (activeMode === 'oscilloscope') {
      ctx.lineWidth = 2;
      ctx.strokeStyle = activeColor;
      ctx.beginPath();
      const sliceWidth = width / data.length;
      let x = 0;
      for (let i = 0; i < data.length; i++) {
        const v = data[i] / 128.0;
        const y = (v * height) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.lineTo(width, height / 2);
      ctx.stroke();
    } else if (activeMode === 'circles') {
      const centerX = width / 2;
      const centerY = height / 2;
      for (let i = 0; i < density; i++) {
        const radius = (data[i] / 255) * (Math.min(width, height) / 2);
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = activeColor;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    } else if (activeMode === 'plasma') {
      const centerX = width / 2;
      const centerY = height / 2;
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(width, height) / 2);
      gradient.addColorStop(0, activeColor);
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      ctx.globalAlpha = avg / 255;
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = 1.0;
    }
  };

  useEffect(() => {
    const resize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', resize);
    resize();
    return () => window.removeEventListener('resize', resize);
  }, []);

  return (
    <div className="w-full h-screen bg-black overflow-hidden flex items-center justify-center relative font-mono text-[#00ff00]">
      <canvas ref={canvasRef} className="w-full h-full" />
      
      {/* Settings Toggle */}
      <button 
        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
        className="absolute top-4 right-4 z-50 p-2 bg-[#222] border-2 border-[#444] hover:text-white hover:border-[#00ff00] transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
      </button>

      {/* Settings Panel */}
      {isSettingsOpen && (
        <div className="absolute top-16 right-4 z-40 bg-[#111] border-2 border-[#333] p-4 shadow-xl">
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="text-sm uppercase mb-2">Visualizer Mode</h3>
              <div className="grid grid-cols-2 gap-2">
                {['spectrum', 'oscilloscope', 'circles', 'plasma', 'bars', 'dots'].map((m) => (
                  <button
                    key={m}
                    onClick={() => setOverrideMode(m as VisualizerMode)}
                    className={`px-3 py-1 text-xs border ${activeMode === m ? 'border-[#00ff00] bg-[#00ff00] text-black' : 'border-[#444] text-[#888] hover:border-[#00ff00] hover:text-[#00ff00]'} uppercase transition-colors`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm uppercase mb-2">Color Scheme</h3>
              <div className="flex gap-2">
                {RETRO_PALETTE.map((p) => (
                  <button
                    key={p.color}
                    onClick={() => setOverrideColor(p.color)}
                    className={`w-6 h-6 border-2 ${activeColor === p.color ? 'border-white' : 'border-transparent'}`}
                    style={{ backgroundColor: p.color }}
                    title={p.name}
                  />
                ))}
              </div>
            </div>

            <button
              onClick={() => {
                setOverrideMode(null);
                setOverrideColor(null);
              }}
              className="text-xs text-[#888] hover:text-white mt-2 border border-[#444] py-1 uppercase"
            >
              Reset to Player Sync
            </button>
          </div>
        </div>
      )}

      <div className="absolute bottom-2 right-2 text-[10px] text-[#00ff00] font-mono opacity-50">
        POPOUT VIZ v1.1
      </div>
    </div>
  );
};

export default VisualizerWindow;
