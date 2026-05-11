import React, { useEffect, useRef } from 'react';
import { VisualizerMode } from '../types';

interface VisualizerProps {
  analyser: AnalyserNode | null;
  mode: VisualizerMode;
  color?: string;
  density?: number;
}

const Visualizer: React.FC<VisualizerProps> = ({ analyser, mode, color = '#00ff00', density = 10 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!analyser || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let dataArray = new Uint8Array(analyser.frequencyBinCount);

    const isBarMode = mode === 'spectrum' || mode === 'bars';
    const isOscilloscopeMode = mode === 'oscilloscope';
    const isCircleMode = mode === 'circles';
    const isPlasmaMode = mode === 'plasma';
    const isMirrorBarsMode = mode === 'mirrorBars';
    const isRadialPulseMode = mode === 'radialPulse';
    const isWaveDotsMode = mode === 'waveDots';

    const alphaSuffixTable = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));

    const draw = () => {
      animationId = requestAnimationFrame(draw);

      const width = canvas.width;
      const height = canvas.height;
      const bufferLength = analyser.frequencyBinCount;

      if (dataArray.length !== bufferLength) {
        dataArray = new Uint8Array(bufferLength);
      }

      ctx.clearRect(0, 0, width, height);

      if (isBarMode) {
        analyser.getByteFrequencyData(dataArray);

        const barWidth = (width / bufferLength) * 2.5;
        const step = barWidth + 1;
        let x = 0;

        ctx.fillStyle = color;
        for (let i = 0; i < bufferLength && x < width; i++) {
          const barHeight = (dataArray[i] / 255) * height;
          ctx.fillRect(x, height - barHeight, barWidth, barHeight);
          x += step;
        }
        return;
      }

      if (isOscilloscopeMode) {
        analyser.getByteTimeDomainData(dataArray);

        ctx.lineWidth = 2;
        ctx.strokeStyle = color;
        ctx.beginPath();

        const sliceWidth = width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const y = ((dataArray[i] / 128) * height) / 2;
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }

        ctx.lineTo(width, height / 2);
        ctx.stroke();
        return;
      }

      if (isCircleMode) {
        analyser.getByteFrequencyData(dataArray);

        const centerX = width / 2;
        const centerY = height / 2;
        const maxRadius = Math.min(width, height) / 2;
        const step = Math.max(1, Math.floor(100 / density));

        for (let i = 0; i < bufferLength; i += step) {
          const value = dataArray[i];
          const radius = (value / 255) * maxRadius;
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
          ctx.strokeStyle = `${color}${alphaSuffixTable[value]}`;
          ctx.stroke();
        }
        return;
      }

      if (isPlasmaMode) {
        analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;

        const gradient = ctx.createRadialGradient(
          width / 2,
          height / 2,
          0,
          width / 2,
          height / 2,
          (avg / 255) * width,
        );
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        return;
      }

      if (isMirrorBarsMode) {
        analyser.getByteFrequencyData(dataArray);
        const halfHeight = height / 2;
        const barWidth = Math.max(1, width / bufferLength);
        let x = 0;

        ctx.fillStyle = color;
        for (let i = 0; i < bufferLength && x < width; i++) {
          const amplitude = (dataArray[i] / 255) * halfHeight;
          ctx.fillRect(x, halfHeight - amplitude, barWidth, amplitude);
          ctx.fillRect(x, halfHeight, barWidth, amplitude);
          x += barWidth;
        }
        return;
      }

      if (isRadialPulseMode) {
        analyser.getByteFrequencyData(dataArray);
        const centerX = width / 2;
        const centerY = height / 2;
        const baseRadius = Math.min(width, height) * 0.18;
        const step = Math.max(4, Math.floor(bufferLength / 96));

        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();

        for (let i = 0; i < bufferLength; i += step) {
          const angle = (i / bufferLength) * Math.PI * 2;
          const pulse = (dataArray[i] / 255) * (Math.min(width, height) * 0.3);
          const radius = baseRadius + pulse;
          const x = centerX + Math.cos(angle) * radius;
          const y = centerY + Math.sin(angle) * radius;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }

        ctx.closePath();
        ctx.stroke();
        return;
      }

      if (isWaveDotsMode) {
        analyser.getByteTimeDomainData(dataArray);
        const step = Math.max(2, Math.floor(bufferLength / 100));
        const spacing = width / Math.ceil(bufferLength / step);
        let x = 0;

        ctx.fillStyle = color;
        for (let i = 0; i < bufferLength; i += step) {
          const normalized = (dataArray[i] - 128) / 128;
          const y = height / 2 + normalized * (height * 0.35);
          const radius = 1 + Math.abs(normalized) * 3;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
          x += spacing;
        }
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [analyser, mode, color, density]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full bg-black border-2 border-[#333] shadow-[inset_0_0_10px_rgba(0,255,0,0.2)]"
      width={600}
      height={300}
    />
  );
};

export default Visualizer;
