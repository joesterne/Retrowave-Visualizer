/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import WinampPlayer from './components/WinampPlayer';
import VisualizerWindow from './components/VisualizerWindow';

export default function App() {
  const path = window.location.pathname;

  if (path === '/visualizer') {
    return <VisualizerWindow />;
  }

  return (
    <div className="min-h-screen bg-black">
      <WinampPlayer />
    </div>
  );
}
