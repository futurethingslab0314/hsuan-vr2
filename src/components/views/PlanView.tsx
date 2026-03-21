import { motion } from 'motion/react';
import { FileText } from 'lucide-react';

interface PlanViewProps {
  setView: (view: 'chat') => void;
  reportNumber: string | null;
  reportContent: string | null;
  isGeneratingPlan: boolean;
}

export const PlanView = ({ setView, reportNumber, reportContent, isGeneratingPlan }: PlanViewProps) => {
  const content = reportContent?.trim();

  return (
    <motion.div
      key="plan"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 flex flex-col items-center justify-center bg-[#F5F5F7] px-6 py-24"
    >
      <div className="max-w-3xl w-full p-12 glass rounded-[40px] shadow-2xl text-center space-y-8 max-h-[80vh] overflow-y-auto">
        <div className="w-20 h-20 bg-black text-white rounded-3xl flex items-center justify-center mx-auto shadow-xl">
          <FileText size={40} />
        </div>
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#86868B]">{reportNumber ?? 'Report Draft'}</p>
          <h1 className="text-4xl font-display font-bold tracking-tight">專案計畫書</h1>
          <p className="text-[#86868B] leading-relaxed">
            {isGeneratingPlan
              ? 'Your comprehensive AI-driven project strategy is being compiled based on the team collaboration.'
              : 'This one-page report summarizes the current analysis, collaboration, and next-step direction.'}
          </p>
        </div>

        {isGeneratingPlan ? (
          <div className="py-12 text-sm text-[#86868B]">Generating your one-page report...</div>
        ) : content ? (
          <pre className="text-left whitespace-pre-wrap text-sm leading-7 bg-white/70 border border-black/5 rounded-3xl p-8 shadow-inner">
            {content}
          </pre>
        ) : (
          <div className="py-12 text-sm text-[#86868B]">No report content yet.</div>
        )}

        <div className="pt-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setView('chat')}
            className="px-10 py-4 bg-black text-white rounded-full font-bold shadow-lg"
          >
            Back to Collaboration
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};
