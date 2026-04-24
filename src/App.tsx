/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import WinampPlayer from './components/WinampPlayer';
import VisualizerWindow from './components/VisualizerWindow';
import { AuthProvider } from './context/AuthContext';

export default function App() {
  const path = window.location.pathname;

  if (path === '/visualizer') {
    return (
      <AuthProvider>
        <VisualizerWindow />
      </AuthProvider>
    );
  }

  return (
    <AuthProvider>
      <div className="min-h-screen bg-black">
        <WinampPlayer />
      </div>
    </AuthProvider>
  );
}
