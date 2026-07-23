import { VisualizerMode } from '../types';

export interface VisualizerRenderOptions {
  mode: VisualizerMode;
  color: string;
  density: number;
  speed: number;
  backgroundColor: string;
  glow: number;
  lineWidth: number;
  barGap: number;
  trail: number;
  mirrored: boolean;
}

const alphaSuffixTable = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));

export const DEFAULT_VISUALIZER_OPTIONS: VisualizerRenderOptions = {
  mode: 'spectrum',
  color: '#00ff00',
  density: 10,
  speed: 1,
  backgroundColor: '#000000',
  glow: 0.35,
  lineWidth: 2,
  barGap: 1,
  trail: 0,
  mirrored: true,
};

const normalizeColor = (color: string, fallback = '#00ff00') => (/^#[0-9a-f]{6}$/i.test(color) ? color : fallback);

export function fillBackground(ctx: CanvasRenderingContext2D, width: number, height: number, color: string, trail: number) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, 1 - trail));
  ctx.fillStyle = normalizeColor(color, '#000000');
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

export function drawVisualizerFrame(ctx: CanvasRenderingContext2D, data: Uint8Array, options: VisualizerRenderOptions) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  if (!width || !height || !data.length) return;

  const color = normalizeColor(options.color);
  const density = Math.max(1, options.density);
  const speed = Math.max(0.25, options.speed);
  const lineWidth = Math.max(1, options.lineWidth);
  const barGap = Math.max(0, options.barGap);

  fillBackground(ctx, width, height, options.backgroundColor, options.trail);

  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = Math.max(0, options.glow) * 24;
  ctx.lineWidth = lineWidth;

  if (options.mode === 'spectrum' || options.mode === 'bars') {
    const visibleBars = Math.max(16, Math.floor(data.length * Math.min(1, density / 50)));
    const stride = Math.max(1, Math.floor(data.length / visibleBars));
    const barWidth = width / Math.ceil(data.length / stride);
    ctx.fillStyle = color;

    let x = 0;
    for (let i = 0; i < data.length && x < width; i += stride) {
      const barHeight = (data[i] / 255) * height * speed;
      const drawWidth = Math.max(1, barWidth - barGap);
      ctx.fillRect(x, height - Math.min(height, barHeight), drawWidth, Math.min(height, barHeight));
      if (options.mirrored) ctx.fillRect(x, 0, drawWidth, Math.min(height, barHeight) * 0.25);
      x += barWidth;
    }
  } else if (options.mode === 'oscilloscope') {
    ctx.strokeStyle = color;
    ctx.beginPath();
    const sliceWidth = width / data.length;
    for (let i = 0; i < data.length; i++) {
      const y = height / 2 + ((data[i] - 128) / 128) * (height * 0.35) * speed;
      if (i === 0) ctx.moveTo(0, y);
      else ctx.lineTo(i * sliceWidth, y);
    }
    ctx.stroke();
  } else if (options.mode === 'circles') {
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(width, height) / 2;
    const step = Math.max(1, Math.floor(data.length / density));
    for (let i = 0; i < data.length; i += step) {
      const value = data[i];
      ctx.beginPath();
      ctx.arc(centerX, centerY, (value / 255) * maxRadius * speed, 0, Math.PI * 2);
      ctx.strokeStyle = `${color}${alphaSuffixTable[value]}`;
      ctx.stroke();
    }
  } else if (options.mode === 'plasma') {
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i];
    const avg = sum / data.length;
    const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * (avg / 255) * speed);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'transparent');
    ctx.globalAlpha = Math.min(1, avg / 180);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  } else if (options.mode === 'mirrorBars') {
    const halfHeight = height / 2;
    const barWidth = width / data.length;
    ctx.fillStyle = color;
    for (let i = 0; i < data.length; i++) {
      const amp = (data[i] / 255) * halfHeight * speed;
      const x = i * barWidth;
      ctx.fillRect(x, halfHeight - amp, Math.max(1, barWidth - barGap), amp);
      ctx.fillRect(x, halfHeight, Math.max(1, barWidth - barGap), amp);
    }
  } else if (options.mode === 'radialPulse') {
    const centerX = width / 2;
    const centerY = height / 2;
    const baseRadius = Math.min(width, height) * 0.18;
    const step = Math.max(3, Math.floor(data.length / Math.max(12, density * 4)));
    ctx.strokeStyle = color;
    ctx.beginPath();
    for (let i = 0; i < data.length; i += step) {
      const angle = (i / data.length) * Math.PI * 2;
      const radius = baseRadius + (data[i] / 255) * (Math.min(width, height) * 0.3) * speed;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  } else if (options.mode === 'waveDots') {
    const step = Math.max(2, Math.floor(data.length / Math.max(10, density * 4)));
    const spacing = width / Math.ceil(data.length / step);
    ctx.fillStyle = color;
    let x = 0;
    for (let i = 0; i < data.length; i += step) {
      const normalized = (data[i] - 128) / 128;
      const y = height / 2 + normalized * height * 0.35 * speed;
      const radius = lineWidth + Math.abs(normalized) * 3;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      x += spacing;
    }
  }

  ctx.restore();
}
