import React from 'react';
import { motion } from 'motion/react';
import { MessageSquare, Send, ArrowLeft, ChevronRight } from 'lucide-react';
import { TeamMember } from '../../types';

interface ChatViewProps {
  messages: { role: string; name: string; content: string; type: 'user' | 'bot' }[];
  members: TeamMember[];
  chatInput: string;
  setChatInput: (val: string) => void;
  handleSendMessage: () => void;
  handleAddMemberToInput: (name: string) => void;
  setView: (view: 'map') => void;
  handleGeneratePlan: () => void;
  isGeneratingPlan: boolean;
  isChatResponding: boolean;
  inputValue: string;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
}

export const ChatView = ({
  messages,
  members,
  chatInput,
  setChatInput,
  handleSendMessage,
  handleAddMemberToInput,
  setView,
  handleGeneratePlan,
  isGeneratingPlan,
  isChatResponding,
  inputValue,
  chatEndRef,
}: ChatViewProps) => {
  return (
    <motion.div key="chat" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="fixed inset-0 pt-8 pb-8 flex flex-col max-w-4xl mx-auto">
      <div className="px-8 py-5 flex items-center justify-between border-b border-black/5 mb-4 min-h-[92px]">
        <div><h2 className="text-xl font-display font-bold">Team Collaboration</h2><p className="text-xs text-[#86868B]">Active Session: {inputValue || 'New Project'}</p></div>
        <div className="flex -space-x-2">{members.map(m => (<div key={m.id} className="w-8 h-8 rounded-full bg-black border-2 border-white flex items-center justify-center text-[10px] text-white font-bold" title={m.role}>{m.name.charAt(0)}</div>))}</div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-60 space-y-6 scrollbar-hide">
        {messages.length === 0 && (<div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40"><MessageSquare size={48} /><p className="text-sm font-medium">Your team is ready. Start the conversation below.</p></div>)}
        {messages.map((msg, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex flex-col ${msg.type === 'user' ? 'items-end' : 'items-start'}`}>
            {msg.type === 'bot' && (<span className="text-[10px] font-bold uppercase tracking-wider text-[#86868B] mb-1 ml-4">{msg.role} • {msg.name}</span>)}
            <div className={`max-w-[80%] px-6 py-4 rounded-2xl text-sm leading-relaxed ${msg.type === 'user' ? 'bg-black text-white rounded-tr-none shadow-lg' : 'bg-white border border-black/5 rounded-tl-none shadow-sm'}`}>{msg.content}</div>
          </motion.div>
        ))}
        {isChatResponding && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start"
          >
            <div className="bg-white border border-black/5 rounded-2xl rounded-tl-none shadow-sm px-5 py-4">
              <div className="flex items-center gap-2">
                {[0, 1, 2].map((index) => (
                  <motion.span
                    key={index}
                    className="w-2.5 h-2.5 rounded-full bg-black/70"
                    animate={{ y: [0, -4, 0], opacity: [0.35, 1, 0.35] }}
                    transition={{
                      duration: 0.8,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      delay: index * 0.12,
                    }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-4xl px-8 z-20">
        <div className="rounded-[28px] bg-[#F5F5F7]/92 backdrop-blur-md px-2 pt-2 pb-4">
          <div className="flex flex-wrap gap-2 mb-3 justify-center">{members.map(m => (<motion.button key={m.id} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => handleAddMemberToInput(m.name)} className="px-3 py-1.5 bg-white border border-black/5 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm hover:bg-black hover:text-white transition-colors">{m.role}</motion.button>))}</div>
          <div className="relative glass p-2 rounded-full shadow-2xl border border-black/5">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
              placeholder="Message your AI team..."
              disabled={isChatResponding}
              className="w-full bg-transparent px-6 py-3 outline-none text-sm disabled:opacity-50"
            />
            <button
              onClick={handleSendMessage}
              disabled={isChatResponding}
              className="absolute right-2 top-2 bottom-2 aspect-square bg-black text-white rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100"
            >
              <Send size={18} />
            </button>
          </div>
          <div className="flex justify-between mt-5 px-2">
            <motion.button whileHover={{ x: -5 }} onClick={() => setView('map')} className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#86868B] hover:text-black transition-colors"><ArrowLeft size={16} /> Back to Map</motion.button>
            <motion.button whileHover={{ x: isGeneratingPlan ? 0 : 5 }} onClick={handleGeneratePlan} disabled={isGeneratingPlan} className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-black hover:opacity-70 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed">{isGeneratingPlan ? 'Generating Plan...' : 'Generate Plan'} <ChevronRight size={16} /></motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
