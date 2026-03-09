import { motion } from 'motion/react';
import { FileText } from 'lucide-react';

interface PlanViewProps {
  setView: (view: 'chat') => void;
}

export const PlanView = ({ setView }: PlanViewProps) => {
  return (
    <motion.div
      key="plan"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 flex flex-col items-center justify-center bg-[#F5F5F7]"
    >
      <div className="max-w-2xl w-full p-12 glass rounded-[40px] shadow-2xl text-center space-y-8">
        <div className="w-20 h-20 bg-black text-white rounded-3xl flex items-center justify-center mx-auto shadow-xl">
          <FileText size={40} />
        </div>
        <h1 className="text-4xl font-display font-bold tracking-tight">專案計畫書</h1>
        <p className="text-[#86868B] leading-relaxed">
          Your comprehensive AI-driven project strategy is being compiled based on the team collaboration.
        </p>
        <div className="pt-8">
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
