import React, { useEffect, useRef, useState } from 'react';
import { VisualizerMode } from '../types';

const VisualizerWindow: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<VisualizerMode>('spectrum');
  const [color, setColor] = useState('#00ff00');
  const [density, setDensity] = useState(10);
  const [speed, setSpeed] = useState(1);
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);
  const visualizerConfigRef = useRef({ mode, color, density, speed });

  const modes: VisualizerMode[] = ['spectrum', 'oscilloscope', 'bars', 'circles', 'plasma', 'mirrorBars', 'radialPulse', 'waveDots'];

  const updateMode = (nextMode: VisualizerMode) => {
    visualizerConfigRef.current.mode = nextMode;
    setMode(nextMode);
  };

  const updateColor = (nextColor: string) => {
    visualizerConfigRef.current.color = nextColor;
    setColor(nextColor);
  };

  const updateDensity = (nextDensity: number) => {
    visualizerConfigRef.current.density = nextDensity;
    setDensity(nextDensity);
  };

  const updateSpeed = (nextSpeed: number) => {
    visualizerConfigRef.current.speed = nextSpeed;
    setSpeed(nextSpeed);
  };

  const draw = (data: Uint8Array, speedValue = visualizerConfigRef.current.speed) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    const { mode: currentMode, color: currentColor, density: currentDensity } = visualizerConfigRef.current;
    const playbackSpeed = Math.max(0.25, speedValue);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    if (currentMode === 'spectrum' || currentMode === 'bars') {
      const barWidth = (width / data.length) * playbackSpeed;
      for (let i = 0; i < data.length; i++) {
        const barHeight = (data[i] / 255) * height;
        ctx.fillStyle = currentColor;
        ctx.fillRect(i * barWidth, height - barHeight, barWidth - 1, barHeight);
      }
    } else if (currentMode === 'oscilloscope') {
      ctx.lineWidth = 2;
      ctx.strokeStyle = currentColor;
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
    } else if (currentMode === 'circles') {
      const centerX = width / 2;
      const centerY = height / 2;
      for (let i = 0; i < currentDensity; i++) {
        const radius = (data[i] / 255) * (Math.min(width, height) / 2);
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    } else if (currentMode === 'plasma') {
      const centerX = width / 2;
      const centerY = height / 2;
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(width, height) / 2);
      gradient.addColorStop(0, currentColor);
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      ctx.globalAlpha = avg / 255;
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = 1.0;
    } else if (currentMode === 'mirrorBars') {
      const halfHeight = height / 2;
      const barWidth = Math.max(1, width / data.length);
      ctx.fillStyle = currentColor;
      for (let i = 0; i < data.length; i++) {
        const amp = (data[i] / 255) * halfHeight;
        const x = i * barWidth;
        ctx.fillRect(x, halfHeight - amp, barWidth - 1, amp);
        ctx.fillRect(x, halfHeight, barWidth - 1, amp);
      }
    } else if (currentMode === 'radialPulse') {
      const centerX = width / 2;
      const centerY = height / 2;
      const baseRadius = Math.min(width, height) * 0.18;
      const step = Math.max(4, Math.floor(data.length / 96));
      ctx.strokeStyle = currentColor;
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
    } else if (currentMode === 'waveDots') {
      const step = Math.max(2, Math.floor(data.length / 100));
      const spacing = width / Math.ceil(data.length / step);
      let x = 0;
      ctx.fillStyle = currentColor;
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
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'VIZ_DATA') {
        const { data, mode: nextMode, color: nextColor, density: nextDensity, speed: nextSpeed } = event.data;
        const config = visualizerConfigRef.current;

        if (nextMode && nextMode !== config.mode) {
          config.mode = nextMode;
          setMode(nextMode);
        }

        if (nextColor && nextColor !== config.color) {
          config.color = nextColor;
          setColor(nextColor);
        }

        if (typeof nextDensity === 'number' && nextDensity !== config.density) {
          config.density = nextDensity;
          setDensity(nextDensity);
        }

        if (typeof nextSpeed === 'number' && nextSpeed !== config.speed) {
          config.speed = nextSpeed;
          setSpeed(nextSpeed);
        }

        draw(data, config.speed);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        canvas.style.width = '100vw';
        canvas.style.height = '100vh';

        const ctx = canvas.getContext('2d');
        ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
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
                onChange={(e) => updateMode(e.target.value as VisualizerMode)}
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
              <input type="color" value={color} onChange={(e) => updateColor(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span>Density</span>
              <input
                type="range"
                min="1"
                max="50"
                value={density}
                onChange={(e) => updateDensity(Number(e.target.value))}
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
                onChange={(e) => updateSpeed(Number(e.target.value))}
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
