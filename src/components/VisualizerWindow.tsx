import React, { useEffect, useRef, useState } from 'react';
import { VisualizerMode } from '../types';

const VisualizerWindow: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<VisualizerMode>('spectrum');
  const [color, setColor] = useState('#00ff00');
  const [density, setDensity] = useState(10);
  const [speed, setSpeed] = useState(1);
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);

  const modes: VisualizerMode[] = ['spectrum', 'oscilloscope', 'bars', 'circles', 'plasma', 'mirrorBars', 'radialPulse', 'waveDots'];

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'VIZ_DATA') {
        const { data, mode: m, color: c, density: d, speed: s } = event.data;
        if (m) setMode(m);
        if (c) setColor(c);
        if (d) setDensity(d);
        if (s) setSpeed(s);
        
        draw(data, s ?? speed);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const draw = (data: Uint8Array, speedValue = speed) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const playbackSpeed = Math.max(0.25, speedValue);
    ctx.clearRect(0, 0, width, height);

    if (mode === 'spectrum' || mode === 'bars') {
      const barWidth = (width / data.length) * playbackSpeed;
      for (let i = 0; i < data.length; i++) {
        const barHeight = (data[i] / 255) * height;
        ctx.fillStyle = color;
        ctx.fillRect(i * barWidth, height - barHeight, barWidth - 1, barHeight);
      }
    } else if (mode === 'oscilloscope') {
      ctx.lineWidth = 2;
      ctx.strokeStyle = color;
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
    } else if (mode === 'circles') {
      const centerX = width / 2;
      const centerY = height / 2;
      for (let i = 0; i < density; i++) {
        const radius = (data[i] / 255) * (Math.min(width, height) / 2);
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    } else if (mode === 'plasma') {
      const centerX = width / 2;
      const centerY = height / 2;
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(width, height) / 2);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      ctx.globalAlpha = avg / 255;
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = 1.0;
    } else if (mode === 'mirrorBars') {
      const halfHeight = height / 2;
      const barWidth = Math.max(1, width / data.length);
      ctx.fillStyle = color;
      for (let i = 0; i < data.length; i++) {
        const amp = (data[i] / 255) * halfHeight;
        const x = i * barWidth;
        ctx.fillRect(x, halfHeight - amp, barWidth - 1, amp);
        ctx.fillRect(x, halfHeight, barWidth - 1, amp);
      }
    } else if (mode === 'radialPulse') {
      const centerX = width / 2;
      const centerY = height / 2;
      const baseRadius = Math.min(width, height) * 0.18;
      const step = Math.max(4, Math.floor(data.length / 96));
      ctx.strokeStyle = color;
      ctx.beginPath();
      for (let i = 0; i < data.length; i += step) {
        const angle = (i / data.length) * Math.PI * 2;
        const radius = baseRadius + (data[i] / 255) * (Math.min(width, height) * 0.3);
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    } else if (mode === 'waveDots') {
      const step = Math.max(2, Math.floor(data.length / 100));
      const spacing = width / Math.ceil(data.length / step);
      let x = 0;
      ctx.fillStyle = color;
      for (let i = 0; i < data.length; i += step) {
        const normalized = (data[i] - 128) / 128;
        const y = height / 2 + normalized * (height * 0.35);
        const radius = 1 + Math.abs(normalized) * 3;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        x += spacing * playbackSpeed;
      }
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
    <div className="w-full h-screen bg-black overflow-hidden flex items-center justify-center">
      <canvas ref={canvasRef} className="w-full h-full" />
      <div className="absolute top-2 left-2 z-10">
        <button
          onClick={() => setIsSettingsOpen((prev) => !prev)}
          className="text-[10px] px-2 py-1 border border-[#00ff00] text-[#00ff00] bg-black/70 font-mono"
        >
          {isSettingsOpen ? 'HIDE SETTINGS' : 'SHOW SETTINGS'}
        </button>

        {isSettingsOpen && (
          <div className="mt-2 p-2 w-44 bg-black/80 border border-[#00ff00] text-[#00ff00] font-mono text-[10px] flex flex-col gap-2">
            <label className="flex flex-col gap-1">
              <span>Mode</span>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as VisualizerMode)}
                className="bg-black border border-[#00ff00] px-1 py-0.5"
              >
                {modes.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center justify-between gap-2">
              <span>Color</span>
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span>Density</span>
              <input
                type="range"
                min="1"
                max="50"
                value={density}
                onChange={(e) => setDensity(Number(e.target.value))}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span>Speed ({speed.toFixed(2)}x)</span>
              <input
                type="range"
                min="0.25"
                max="2"
                step="0.05"
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
              />
            </label>
          </div>
        )}
      </div>
      <div className="absolute bottom-2 right-2 text-[10px] text-[#00ff00] font-mono opacity-50">
        POPOUT VIZ v1.0
      </div>
    </div>
  );
};

export default VisualizerWindow;
