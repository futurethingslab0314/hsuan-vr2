import { motion } from 'motion/react';

export const LoadingView = () => {
  return (
    <motion.div
      key="loading"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 flex flex-col items-center justify-center bg-[#F5F5F7] z-[100]"
    >
      <h2 className="text-2xl font-display font-medium tracking-tight">Analyzing Project Context...</h2>
      <p className="text-[#86868B] mt-2">Assembling your specialized AI design team</p>
    </motion.div>
  );
};
