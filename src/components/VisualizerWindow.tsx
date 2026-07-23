import React, { useEffect, useMemo, useRef, useState } from 'react';
import { VisualizerMode } from '../types';
import { DEFAULT_VISUALIZER_OPTIONS, VisualizerRenderOptions, drawVisualizerFrame } from './visualizerRenderer';

const modes: VisualizerMode[] = ['spectrum', 'oscilloscope', 'bars', 'circles', 'plasma', 'mirrorBars', 'radialPulse', 'waveDots'];

const VisualizerWindow: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [settings, setSettings] = useState<VisualizerRenderOptions>(DEFAULT_VISUALIZER_OPTIONS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);

  const updateSettings = (patch: Partial<VisualizerRenderOptions>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      window.opener?.postMessage({ type: 'VIZ_SETTINGS_CHANGED', settings: next }, window.location.origin);
      return next;
    });
  };

  const controlColor = settings.color;
  const canvasOptions = useMemo(() => settings, [settings]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.data?.type !== 'VIZ_DATA') return;
      const { data, settings: incomingSettings } = event.data;
      if (incomingSettings) setSettings((prev) => ({ ...prev, ...incomingSettings }));
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx || !data) return;
      drawVisualizerFrame(ctx, data, { ...canvasOptions, ...incomingSettings });
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [canvasOptions]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(window.innerWidth * dpr));
      canvas.height = Math.max(1, Math.floor(window.innerHeight * dpr));
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
            <label className="flex items-center justify-between gap-2"><span>Color</span><input type="color" value={controlColor} onChange={(e) => updateSettings({ color: e.target.value })} /></label>
            <label className="flex items-center justify-between gap-2"><span>BG</span><input type="color" value={settings.backgroundColor} onChange={(e) => updateSettings({ backgroundColor: e.target.value })} /></label>
            {[
              ['Density', 'density', 1, 64, 1, settings.density],
              ['Speed', 'speed', 0.25, 2, 0.05, settings.speed],
              ['Glow', 'glow', 0, 1, 0.05, settings.glow],
              ['Line', 'lineWidth', 1, 8, 0.5, settings.lineWidth],
              ['Gap', 'barGap', 0, 8, 0.5, settings.barGap],
              ['Trail', 'trail', 0, 0.9, 0.05, settings.trail],
            ].map(([label, key, min, max, step, value]) => (
              <label key={key as string} className="flex flex-col gap-1">
                <span>{label} ({Number(value).toFixed(Number(step) < 1 ? 2 : 0)})</span>
                <input type="range" min={min as number} max={max as number} step={step as number} value={value as number} onChange={(e) => updateSettings({ [key as keyof VisualizerRenderOptions]: Number(e.target.value) } as Partial<VisualizerRenderOptions>)} />
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
