import React, { useEffect, useRef, useState } from 'react';
import { VisualizerMode } from '../types';

const VisualizerWindow: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<VisualizerMode>('spectrum');
  const [color, setColor] = useState('#00ff00');
  const [density, setDensity] = useState(10);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'VIZ_DATA') {
        const { data, mode: m, color: c, density: d } = event.data;
        if (m) setMode(m);
        if (c) setColor(c);
        if (d) setDensity(d);
        
        draw(data);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const draw = (data: Uint8Array) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    if (mode === 'spectrum') {
      const barWidth = width / data.length;
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
      <div className="absolute bottom-2 right-2 text-[10px] text-[#00ff00] font-mono opacity-50">
        POPOUT VIZ v1.0
      </div>
    </div>
  );
};

export default VisualizerWindow;
