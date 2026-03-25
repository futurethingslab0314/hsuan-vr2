import { motion, AnimatePresence } from 'motion/react';
import { User, ChevronRight, X, Briefcase, Activity, BookOpen, FileText, MessageSquare, Save } from 'lucide-react';
import { TeamMember } from '../../types';
import { RelationshipLines } from '../RelationshipLines';

interface MapViewProps {
  members: TeamMember[];
  selectedMemberId: string | null;
  setSelectedMemberId: (id: string | null) => void;
  tempMember: TeamMember | null;
  setTempMember: (member: TeamMember | null) => void;
  handleSaveMember: () => void | Promise<void>;
  inputValue: string;
  setView: (view: 'chat') => void;
}

export const MapView = ({
  members,
  selectedMemberId,
  setSelectedMemberId,
  tempMember,
  setTempMember,
  handleSaveMember,
  inputValue,
  setView
}: MapViewProps) => {
  return (
    <motion.div 
      key="map"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 pt-24"
    >
      <div className="relative w-full h-full max-w-6xl mx-auto flex items-center justify-center">
        <RelationshipLines members={members} />
        
        {members.map((member) => (
          <motion.div
            key={member.id}
            className="absolute cursor-pointer group"
            style={{ 
              left: `${member.position.x}%`, 
              top: `${member.position.y}%`,
            }}
            initial={{ x: '-50%', y: '-50%', scale: 1 }}
            whileHover={{ scale: 1.05, x: '-50%', y: '-50%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            onClick={() => setSelectedMemberId(member.id)}
          >
            <div className={`
              glass p-6 rounded-2xl w-56 shadow-lg transition-shadow duration-300
              ${selectedMemberId === member.id ? 'ring-2 ring-black shadow-2xl' : 'hover:shadow-xl'}
            `}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center text-white">
                  <User size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-tight">{member.name}</h3>
                  <p className="text-xs text-[#86868B]">{member.role}</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-1.5 w-full bg-black/5 rounded-full overflow-hidden">
                  <div className="h-full bg-black/20 w-3/4"></div>
                </div>
                <p className="text-[10px] text-[#86868B] line-clamp-2 leading-relaxed">
                  {member.roleTarget}
                </p>
              </div>
            </div>
          </motion.div>
        ))}

        <div className="text-center z-10 pointer-events-none">
          <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-[#86868B] mb-1">Project Core</h4>
          <p className="text-lg font-display font-medium max-w-[200px] leading-tight">
            {inputValue || "Design Workspace"}
          </p>
        </div>

        <div className="absolute bottom-12 right-12 z-50">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setView('chat')}
            className="flex items-center gap-2 px-8 py-4 bg-black text-white rounded-full font-bold shadow-2xl group"
          >
            Start Collaboration
            <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </motion.button>
        </div>
      </div>

      <AnimatePresence>
        {selectedMemberId && tempMember && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/5 backdrop-blur-sm z-[60]"
              onClick={() => setSelectedMemberId(null)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-xl glass-dark z-[70] shadow-2xl flex flex-col text-white"
            >
              <div className="p-8 flex items-center justify-between border-b border-white/10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-black">
                    <User size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-display font-bold">{tempMember.name}</h2>
                    <p className="text-sm text-white/60">{tempMember.role}</p>
                  </div>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedMemberId(null);
                  }}
                  className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/20 active:scale-95 transition-all cursor-pointer z-[80]"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide">
                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/40">
                    <Briefcase size={14} /> Role Background Identity
                  </div>
                  <textarea
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-white/30 min-h-[100px] resize-none"
                    value={tempMember.roleBackgroundIdentity}
                    onChange={e => setTempMember({ ...tempMember, roleBackgroundIdentity: e.target.value })}
                  />
                </section>

                <section className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/40">
                    <Activity size={14} /> Role Target
                  </div>
                  <textarea
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-white/30 min-h-[80px] resize-none"
                    value={tempMember.roleTarget}
                    onChange={e => setTempMember({ ...tempMember, roleTarget: e.target.value })}
                  />
                </section>

                <section className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/40">
                    <BookOpen size={14} /> Role Knowledge Reference
                  </div>
                  <textarea
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-white/30 min-h-[80px] resize-none"
                    value={tempMember.roleKnowledgeReference}
                    onChange={e => setTempMember({ ...tempMember, roleKnowledgeReference: e.target.value })}
                  />
                </section>

                <section className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/40">
                    <FileText size={14} /> Role Rules
                  </div>
                  <textarea
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-white/30 min-h-[80px] resize-none"
                    value={tempMember.roleRules}
                    onChange={e => setTempMember({ ...tempMember, roleRules: e.target.value })}
                  />
                </section>

                <section className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/40">
                    <ChevronRight size={14} /> Role Workflow
                  </div>
                  <textarea
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-white/30 min-h-[80px] resize-none"
                    value={tempMember.roleWorkflow}
                    onChange={e => setTempMember({ ...tempMember, roleWorkflow: e.target.value })}
                  />
                </section>

                <section className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/40">
                    <FileText size={14} /> Role Response Format
                  </div>
                  <textarea
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-white/30 min-h-[80px] resize-none"
                    value={tempMember.roleResponseFormat}
                    onChange={e => setTempMember({ ...tempMember, roleResponseFormat: e.target.value })}
                  />
                </section>

                <section className="space-y-2 pb-12">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/40">
                    <MessageSquare size={14} /> Role Tone
                  </div>
                  <input
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-white/30"
                    value={tempMember.roleTone}
                    onChange={e => setTempMember({ ...tempMember, roleTone: e.target.value })}
                  />
                </section>
              </div>

              <div className="p-8 border-t border-white/10 flex justify-end">
                <button 
                  onClick={handleSaveMember}
                  className="flex items-center gap-2 px-8 py-3 bg-white text-black rounded-full font-bold hover:scale-105 transition-transform"
                >
                  <Save size={18} /> Save Changes
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
