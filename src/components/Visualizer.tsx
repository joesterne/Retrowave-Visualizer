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

    const draw = () => {
      animationId = requestAnimationFrame(draw);
      
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const bufferLength = analyser.frequencyBinCount;
      if (dataArray.length !== bufferLength) {
        dataArray = new Uint8Array(bufferLength);
      }

      if (mode === 'spectrum' || mode === 'bars') {
        analyser.getByteFrequencyData(dataArray);
        const barWidth = (width / bufferLength) * 2.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * height;
          ctx.fillStyle = color;
          ctx.fillRect(x, height - barHeight, barWidth, barHeight);
          x += barWidth + 1;
        }
      } else if (mode === 'oscilloscope') {
        analyser.getByteTimeDomainData(dataArray);
        ctx.lineWidth = 2;
        ctx.strokeStyle = color;
        ctx.beginPath();

        const sliceWidth = (width * 1.0) / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * height) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }

          x += sliceWidth;
        }

        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
      } else if (mode === 'circles') {
        analyser.getByteFrequencyData(dataArray);
        const centerX = width / 2;
        const centerY = height / 2;
        
        // Use density prop here
        const step = Math.max(1, Math.floor(100 / density));
        for (let i = 0; i < bufferLength; i += step) {
          const radius = (dataArray[i] / 255) * (Math.min(width, height) / 2);
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
          ctx.strokeStyle = `${color}${Math.floor((dataArray[i]/255) * 255).toString(16).padStart(2, '0')}`;
          ctx.stroke();
        }
      } else if (mode === 'plasma') {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / bufferLength;
        const gradient = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, (avg/255) * width);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
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
