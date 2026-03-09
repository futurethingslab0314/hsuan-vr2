import { motion } from 'motion/react';
import { Send } from 'lucide-react';

interface HomeViewProps {
  inputValue: string;
  setInputValue: (val: string) => void;
  isFocused: boolean;
  setIsFocused: (val: boolean) => void;
  handleStartAnalysis: () => void;
}

export const HomeView = ({ inputValue, setInputValue, isFocused, setIsFocused, handleStartAnalysis }: HomeViewProps) => {
  return (
    <motion.main key="home" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="relative flex flex-col items-center justify-center text-center max-w-5xl mx-auto h-screen px-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: 'easeOut' }}>
        <h2 className="text-[#86868B] font-display text-3xl md:text-4xl font-light mb-4 tracking-tight">Rebooting the</h2>
        <h1 className="text-6xl md:text-8xl font-display font-semibold tracking-tighter mb-8 leading-[1.1]">Creative Connection.</h1>
        <p className="text-[#86868B] text-xl md:text-2xl max-w-2xl mx-auto mb-16 leading-relaxed font-light">Describe your design goals, pain points, or concept. We&apos;ll assemble the perfect AI team for you.</p>
      </motion.div>

      <div className="relative w-full max-w-lg">
        <div className={`glass rounded-full p-2 flex items-center transition-all duration-500 ${isFocused ? 'ring-4 ring-black/5 shadow-2xl scale-[1.02]' : 'shadow-xl'}`}>
          <input type="text" placeholder="Describe your design project..." className="flex-1 bg-transparent border-none outline-none px-6 py-2 text-base font-medium placeholder:text-[#86868B]/60" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onFocus={() => setIsFocused(true)} onBlur={() => setIsFocused(false)} onKeyDown={(e) => e.key === 'Enter' && handleStartAnalysis()} />
          <button onClick={handleStartAnalysis} className="glass-dark h-10 px-6 rounded-full flex items-center justify-center gap-2 text-white transition-all duration-300 hover:scale-105 rainbow-glow"><Send size={18} /></button>
        </div>
        <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-3/4 h-12 bg-black/5 blur-3xl -z-10 rounded-full"></div>
      </div>
    </motion.main>
  );
};
