import React, { useCallback, useEffect, useRef, useState } from 'react';
import { VisualizerMode } from '../types';
import { DEFAULT_VISUALIZER_OPTIONS, VisualizerRenderOptions, drawVisualizerFrame } from './visualizerRenderer';

const modes: VisualizerMode[] = ['spectrum', 'oscilloscope', 'bars', 'circles', 'plasma', 'mirrorBars', 'radialPulse', 'waveDots'];

type NumericVisualizerKey = 'density' | 'speed' | 'glow' | 'lineWidth' | 'barGap' | 'trail';

const rangeControls: Array<[string, NumericVisualizerKey, number, number, number]> = [
  ['Density', 'density', 1, 64, 1],
  ['Speed', 'speed', 0.25, 2, 0.05],
  ['Glow', 'glow', 0, 1, 0.05],
  ['Line', 'lineWidth', 1, 8, 0.5],
  ['Gap', 'barGap', 0, 8, 0.5],
  ['Trail', 'trail', 0, 0.9, 0.05],
];

const areSettingsEqual = (a: VisualizerRenderOptions, b: VisualizerRenderOptions) => (
  a.mode === b.mode
  && a.color === b.color
  && a.backgroundColor === b.backgroundColor
  && a.density === b.density
  && a.speed === b.speed
  && a.glow === b.glow
  && a.lineWidth === b.lineWidth
  && a.barGap === b.barGap
  && a.trail === b.trail
  && a.mirrored === b.mirrored
);

const VisualizerWindow: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const settingsRef = useRef<VisualizerRenderOptions>(DEFAULT_VISUALIZER_OPTIONS);
  const [settings, setSettings] = useState<VisualizerRenderOptions>(DEFAULT_VISUALIZER_OPTIONS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);

  const commitSettings = useCallback((next: VisualizerRenderOptions) => {
    settingsRef.current = next;
    setSettings((prev) => (areSettingsEqual(prev, next) ? prev : next));
  }, []);

  const updateSettings = useCallback((patch: Partial<VisualizerRenderOptions>) => {
    const next = { ...settingsRef.current, ...patch };
    commitSettings(next);
    window.opener?.postMessage({ type: 'VIZ_SETTINGS_CHANGED', settings: next }, window.location.origin);
  }, [commitSettings]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.data?.type !== 'VIZ_DATA') return;
      const { data, settings: incomingSettings } = event.data;
      const nextSettings = incomingSettings ? { ...settingsRef.current, ...incomingSettings } : settingsRef.current;
      if (incomingSettings) commitSettings(nextSettings);

      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx || !data) return;
      drawVisualizerFrame(ctx, data, nextSettings);
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [commitSettings]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.floor(window.innerWidth * dpr));
      const height = Math.max(1, Math.floor(window.innerHeight * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
    };
    window.addEventListener('resize', resize);
    resize();
    return () => window.removeEventListener('resize', resize);
  }, []);

  return (
    <div className="w-full h-screen bg-black overflow-hidden flex items-center justify-center">
      <canvas ref={canvasRef} className="w-full h-full" />
      <div className="absolute top-2 left-2 z-10 max-w-[calc(100vw-1rem)]">
        <button
          onClick={() => setIsSettingsOpen((prev) => !prev)}
          className="text-[10px] px-2 py-1 border border-[#00ff00] text-[#00ff00] bg-black/70 font-mono"
        >
          {isSettingsOpen ? 'HIDE SETTINGS' : 'SHOW SETTINGS'}
        </button>

        {isSettingsOpen && (
          <div className="mt-2 p-3 w-64 bg-black/85 border border-[#00ff00] text-[#00ff00] font-mono text-[10px] grid grid-cols-2 gap-3">
            <label className="col-span-2 flex flex-col gap-1">
              <span>Mode</span>
              <select
                value={settings.mode}
                onChange={(e) => updateSettings({ mode: e.target.value as VisualizerMode })}
                className="bg-black border border-[#00ff00] px-1 py-0.5"
              >
                {modes.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
            <label className="flex items-center justify-between gap-2"><span>Color</span><input type="color" value={settings.color} onChange={(e) => updateSettings({ color: e.target.value })} /></label>
            <label className="flex items-center justify-between gap-2"><span>BG</span><input type="color" value={settings.backgroundColor} onChange={(e) => updateSettings({ backgroundColor: e.target.value })} /></label>
            {rangeControls.map(([label, key, min, max, step]) => (
              <label key={key} className="flex flex-col gap-1">
                <span>{label} ({settings[key].toFixed(step < 1 ? 2 : 0)})</span>
                <input type="range" min={min} max={max} step={step} value={settings[key]} onChange={(e) => updateSettings({ [key]: Number(e.target.value) })} />
              </label>
            ))}
            <label className="col-span-2 flex items-center gap-2">
              <input type="checkbox" checked={settings.mirrored} onChange={(e) => updateSettings({ mirrored: e.target.checked })} />
              <span>Mirror spectrum accents</span>
            </label>
          </div>
        )}
      </div>
      <div className="absolute bottom-2 right-2 text-[10px] text-[#00ff00] font-mono opacity-50">POPOUT VIZ v1.0</div>
    </div>
  );
};

export default VisualizerWindow;
