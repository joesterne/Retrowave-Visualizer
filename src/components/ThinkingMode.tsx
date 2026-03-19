import React, { useState } from 'react';
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { Brain, Sparkles, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import RetroButton from './RetroButton';

interface ThinkingModeProps {
  isOpen: boolean;
  onClose: () => void;
  currentTrack: any;
}

const ThinkingMode: React.FC<ThinkingModeProps> = ({ isOpen, onClose, currentTrack }) => {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  const handleThink = async () => {
    if (!query) return;
    setIsThinking(true);
    setResponse('');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const result = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: `User is listening to: ${currentTrack?.title || 'Unknown'} by ${currentTrack?.artist || 'Unknown'}. 
        User asks: ${query}. 
        Provide a deep, insightful, and slightly retro-futuristic analysis of the music, its cultural impact, or suggest similar tracks. 
        Use the 'ThinkingLevel.HIGH' capability to reason deeply about the music's structure and history.`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
        }
      });

      setResponse(result.text || 'The AI is speechless.');
    } catch (error) {
      console.error('Thinking error:', error);
      setResponse('Error connecting to the neural network.');
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <div className="w-full max-w-2xl bg-[#222] border-4 border-[#00ff00] shadow-[0_0_20px_rgba(0,255,0,0.3)] flex flex-col max-h-[80vh]">
            <div className="bg-[#00ff00] text-black px-4 py-2 flex justify-between items-center font-bold">
              <div className="flex items-center gap-2">
                <Brain size={18} />
                <span>GENIUS NEURAL ANALYZER</span>
              </div>
              <button onClick={onClose} className="hover:bg-black/10 p-1"><X size={18} /></button>
            </div>

            <div className="p-6 flex flex-col gap-4 overflow-y-auto">
              <div className="bg-black border border-[#333] p-4 font-mono text-xs text-[#00aa00] leading-relaxed">
                {isThinking ? (
                  <div className="flex flex-col items-center gap-4 py-8">
                    <div className="w-12 h-12 border-4 border-[#00ff00] border-t-transparent rounded-full animate-spin" />
                    <div className="animate-pulse">ANALYZING SONIC PATTERNS...</div>
                  </div>
                ) : response ? (
                  <div className="whitespace-pre-wrap">{response}</div>
                ) : (
                  <div className="text-center py-8 opacity-50 italic">
                    READY FOR INPUT. ASK ME ABOUT THE MUSIC, ITS HISTORY, OR FOR RECOMMENDATIONS.
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <input 
                  type="text"
                  placeholder="WHAT'S ON YOUR MIND?"
                  className="flex-1 bg-black border border-[#333] px-4 py-2 text-sm text-[#00ff00] focus:outline-none focus:border-[#00ff00]"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleThink()}
                />
                <RetroButton onClick={handleThink} disabled={isThinking} className="flex items-center gap-2">
                  <Sparkles size={14} />
                  <span>THINK</span>
                </RetroButton>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ThinkingMode;
