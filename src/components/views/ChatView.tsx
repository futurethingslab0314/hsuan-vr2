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
  setView: (view: 'map' | 'plan') => void;
  inputValue: string;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
}

export const ChatView = ({ messages, members, chatInput, setChatInput, handleSendMessage, handleAddMemberToInput, setView, inputValue, chatEndRef }: ChatViewProps) => {
  return (
    <motion.div key="chat" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="fixed inset-0 pt-24 pb-32 flex flex-col max-w-4xl mx-auto">
      <div className="px-8 py-4 flex items-center justify-between border-b border-black/5 mb-4">
        <div><h2 className="text-xl font-display font-bold">Team Collaboration</h2><p className="text-xs text-[#86868B]">Active Session: {inputValue || 'New Project'}</p></div>
        <div className="flex -space-x-2">{members.map(m => (<div key={m.id} className="w-8 h-8 rounded-full bg-black border-2 border-white flex items-center justify-center text-[10px] text-white font-bold" title={m.role}>{m.name.charAt(0)}</div>))}</div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 space-y-6 scrollbar-hide">
        {messages.length === 0 && (<div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40"><MessageSquare size={48} /><p className="text-sm font-medium">Your team is ready. Start the conversation below.</p></div>)}
        {messages.map((msg, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex flex-col ${msg.type === 'user' ? 'items-end' : 'items-start'}`}>
            {msg.type === 'bot' && (<span className="text-[10px] font-bold uppercase tracking-wider text-[#86868B] mb-1 ml-4">{msg.role} • {msg.name}</span>)}
            <div className={`max-w-[80%] px-6 py-4 rounded-2xl text-sm leading-relaxed ${msg.type === 'user' ? 'bg-black text-white rounded-tr-none shadow-lg' : 'bg-white border border-black/5 rounded-tl-none shadow-sm'}`}>{msg.content}</div>
          </motion.div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <div className="fixed bottom-12 left-1/2 -translate-x-1/2 w-full max-w-4xl px-8">
        <div className="flex flex-wrap gap-2 mb-4 justify-center">{members.map(m => (<motion.button key={m.id} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => handleAddMemberToInput(m.name)} className="px-3 py-1.5 bg-white border border-black/5 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm hover:bg-black hover:text-white transition-colors">{m.role}</motion.button>))}</div>
        <div className="relative glass p-2 rounded-full shadow-2xl border border-black/5">
          <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMessage()} placeholder="Message your AI team..." className="w-full bg-transparent px-6 py-3 outline-none text-sm" />
          <button onClick={handleSendMessage} className="absolute right-2 top-2 bottom-2 aspect-square bg-black text-white rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all"><Send size={18} /></button>
        </div>
        <div className="flex justify-between mt-6">
          <motion.button whileHover={{ x: -5 }} onClick={() => setView('map')} className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#86868B] hover:text-black transition-colors"><ArrowLeft size={16} /> Back to Map</motion.button>
          <motion.button whileHover={{ x: 5 }} onClick={() => setView('plan')} className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-black hover:opacity-70 transition-opacity">Generate Plan <ChevronRight size={16} /></motion.button>
        </div>
      </div>
    </motion.div>
  );
};
