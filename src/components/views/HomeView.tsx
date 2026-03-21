import { motion } from 'motion/react';
import { Send, ChevronDown } from 'lucide-react';
import { PROJECT_STAGE_OPTIONS, PROJECT_STAGE_VALUES } from '../../constants/projectStages';

interface HomeViewProps {
  projectRequirements: string;
  setProjectRequirements: (val: string) => void;
  designGoals: string;
  setDesignGoals: (val: string) => void;
  currentPhase: string;
  setCurrentPhase: (val: (typeof PROJECT_STAGE_VALUES)[number]) => void;
  isFocused: boolean;
  setIsFocused: (val: boolean) => void;
  handleStartAnalysis: () => void;
}

export const HomeView = ({
  projectRequirements,
  setProjectRequirements,
  designGoals,
  setDesignGoals,
  currentPhase,
  setCurrentPhase,
  isFocused,
  setIsFocused,
  handleStartAnalysis,
}: HomeViewProps) => {
  return (
    <motion.main key="home" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="relative flex flex-col items-center justify-center text-center max-w-6xl mx-auto h-screen px-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: 'easeOut' }}>
        <h2 className="text-[#86868B] font-display text-3xl md:text-4xl font-light mb-4 tracking-tight">Rebooting the</h2>
        <h1 className="text-6xl md:text-8xl font-display font-semibold tracking-tighter mb-8 leading-[1.1]">Creative Connection.</h1>
        <p className="text-[#86868B] text-xl md:text-2xl max-w-3xl mx-auto mb-16 leading-relaxed font-light">Describe the project context, define the intended design outcome, and place the work in the right stage. We&apos;ll assemble the right AI team from there.</p>
      </motion.div>

      <div className="relative w-full max-w-5xl">
        <div
          className={`glass rounded-full p-2 flex items-center transition-all duration-500 gap-2 ${
            isFocused ? 'ring-4 ring-black/5 shadow-2xl scale-[1.01]' : 'shadow-xl'
          }`}
        >
          <div className="flex-1 min-w-0">
            <input
              type="text"
              placeholder="專案需求 (背景、問題、情境)"
              className="w-full bg-transparent border-none outline-none px-6 py-2 text-sm font-medium placeholder:text-[#86868B]/60"
              value={projectRequirements}
              onChange={(e) => setProjectRequirements(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onKeyDown={(e) => e.key === 'Enter' && handleStartAnalysis()}
            />
          </div>

          <div className="w-px h-6 bg-black/10" />

          <div className="flex-1 min-w-0">
            <input
              type="text"
              placeholder="設計目標 (這次想要達成的結果)"
              className="w-full bg-transparent border-none outline-none px-6 py-2 text-sm font-medium placeholder:text-[#86868B]/60"
              value={designGoals}
              onChange={(e) => setDesignGoals(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onKeyDown={(e) => e.key === 'Enter' && handleStartAnalysis()}
            />
          </div>

          <div className="w-px h-6 bg-black/10" />

          <div className="relative min-w-[220px]">
            <select
              className="w-full bg-transparent border-none outline-none px-6 py-2 text-sm font-medium text-[#1D1D1F] appearance-none cursor-pointer"
              value={currentPhase}
              onChange={(e) => setCurrentPhase(e.target.value as (typeof PROJECT_STAGE_VALUES)[number])}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
            >
              {PROJECT_STAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#86868B]">
              <ChevronDown size={16} />
            </div>
          </div>

          <button
            onClick={handleStartAnalysis}
            className="glass-dark h-10 px-6 rounded-full flex items-center justify-center gap-2 text-white transition-all duration-300 hover:scale-105 rainbow-glow ml-2"
          >
            <Send size={18} />
          </button>
        </div>
        <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-3/4 h-12 bg-black/5 blur-3xl -z-10 rounded-full"></div>
      </div>
    </motion.main>
  );
};
