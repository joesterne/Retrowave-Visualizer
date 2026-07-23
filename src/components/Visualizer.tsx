import React, { useEffect, useMemo, useRef } from 'react';
import { VisualizerMode } from '../types';
import { DEFAULT_VISUALIZER_OPTIONS, drawVisualizerFrame } from './visualizerRenderer';

interface VisualizerProps {
  analyser: AnalyserNode | null;
  mode: VisualizerMode;
  color?: string;
  density?: number;
  speed?: number;
  backgroundColor?: string;
  glow?: number;
  lineWidth?: number;
  barGap?: number;
  trail?: number;
  mirrored?: boolean;
}

const Visualizer: React.FC<VisualizerProps> = ({
  analyser,
  mode,
  color = DEFAULT_VISUALIZER_OPTIONS.color,
  density = DEFAULT_VISUALIZER_OPTIONS.density,
  speed = DEFAULT_VISUALIZER_OPTIONS.speed,
  backgroundColor = DEFAULT_VISUALIZER_OPTIONS.backgroundColor,
  glow = DEFAULT_VISUALIZER_OPTIONS.glow,
  lineWidth = DEFAULT_VISUALIZER_OPTIONS.lineWidth,
  barGap = DEFAULT_VISUALIZER_OPTIONS.barGap,
  trail = DEFAULT_VISUALIZER_OPTIONS.trail,
  mirrored = DEFAULT_VISUALIZER_OPTIONS.mirrored,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasSizeRef = useRef({ width: 0, height: 0 });

  const options = useMemo(() => ({
    mode,
    color,
    density,
    speed,
    backgroundColor,
    glow,
    lineWidth,
    barGap,
    trail,
    mirrored,
  }), [mode, color, density, speed, backgroundColor, glow, lineWidth, barGap, trail, mirrored]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.floor(rect.width * dpr));
      const height = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        canvasSizeRef.current = { width, height };
      }
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    window.addEventListener('resize', resize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, []);

  useEffect(() => {
    if (!analyser || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let dataArray = new Uint8Array(analyser.frequencyBinCount);
    let lastDrawTime = 0;

    const draw = (time: number) => {
      animationId = requestAnimationFrame(draw);
      const frameInterval = 1000 / (30 + options.speed * 30);
      if (time - lastDrawTime < frameInterval) return;
      lastDrawTime = time;

      const bufferLength = analyser.frequencyBinCount;
      if (dataArray.length !== bufferLength) dataArray = new Uint8Array(bufferLength);

      if (options.mode === 'oscilloscope' || options.mode === 'waveDots') {
        analyser.getByteTimeDomainData(dataArray);
      } else {
        analyser.getByteFrequencyData(dataArray);
      }

      drawVisualizerFrame(ctx, dataArray, options);
    };

    animationId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animationId);
  }, [analyser, options]);

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full bg-black border-2 border-[#333] shadow-[inset_0_0_10px_rgba(0,255,0,0.2)]"
    />
  );
};

export default Visualizer;
