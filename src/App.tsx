'use client';

import React, { useState, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Home } from 'lucide-react';
import { TeamMember } from './types';
import { DEFAULT_MEMBERS } from './constants';
import { CustomCursor } from './components/CustomCursor';
import { HomeView } from './components/views/HomeView';
import { LoadingView } from './components/views/LoadingView';
import { MapView } from './components/views/MapView';
import { ChatView } from './components/views/ChatView';
import { PlanView } from './components/views/PlanView';

export default function App() {
  const [view, setView] = useState<'home' | 'loading' | 'map' | 'chat' | 'plan'>('home');
  const [inputValue, setInputValue] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<{ role: string; name: string; content: string; type: 'user' | 'bot' }[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>(DEFAULT_MEMBERS);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [tempMember, setTempMember] = useState<TeamMember | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const handleAddMemberToInput = (name: string) => {
    setChatInput((prev) => {
      const trimmed = prev.trim();
      const mention = `@${name}`;
      if (!trimmed) return `${mention} `;
      if (trimmed.includes(mention)) return prev;
      return `${trimmed} ${mention} `;
    });
  };

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    const newUserMessage = { role: 'User', name: 'You', content: chatInput, type: 'user' as const };
    setMessages((prev) => [...prev, newUserMessage]);
    setChatInput('');
    setTimeout(() => {
      const randomMember = members[Math.floor(Math.random() * members.length)];
      const botResponse = {
        role: randomMember.role,
        name: randomMember.name,
        content: `As the ${randomMember.role}, I've analyzed your input: "${chatInput}".`,
        type: 'bot' as const,
      };
      setMessages((prev) => [...prev, botResponse]);
    }, 1000);
  };

  const handleSelectMember = (id: string | null) => {
    setSelectedMemberId(id);
    if (!id) {
      setTempMember(null);
      return;
    }

    const member = members.find((m) => m.id === id);
    setTempMember(member ? { ...member } : null);
  };

  const handleStartAnalysis = async () => {
    if (!inputValue.trim() || isCreatingProject) return;

    setIsCreatingProject(true);
    setView('loading');

    try {
      const response = await fetch('/api/projects/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_name: 'User',
          input_prompt: inputValue,
          is_public: false,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || 'Failed to create project');
      }

      setProjectId(data.project_id);
      setView('map');
    } catch (error) {
      console.error('[handleStartAnalysis]', error);
      setView('home');
      alert('建立專案失敗，請檢查 Notion 欄位名稱與環境變數後再試一次。');
    } finally {
      setIsCreatingProject(false);
    }
  };

  const handleSaveMember = () => {
    if (!tempMember) return;
    setMembers((prev) => prev.map((m) => (m.id === tempMember.id ? tempMember : m)));
    setSelectedMemberId(null);
    setTempMember(null);
  };

  return (
    <div className="min-h-screen max-w-[1920px] max-h-[1080px] mx-auto bg-[#F5F5F7] text-[#1D1D1F] font-sans overflow-hidden relative">
      <div className="fixed inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-12 py-8 max-w-[1920px] mx-auto">
        <div className="flex items-center gap-3 font-display font-semibold text-xl tracking-tight cursor-pointer group" onClick={() => setView('home')}>
          <div className="w-10 h-10 bg-transparent text-black border border-black/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform"><Home size={20} /></div>
          <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">Home</span>
        </div>
        <AnimatePresence>{view === 'home' && (<motion.button key="signin" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="px-8 py-3 bg-black text-white rounded-full text-base font-medium hover:scale-105 transition-transform shadow-lg">Sign in</motion.button>)}</AnimatePresence>
      </nav>
      <AnimatePresence mode="wait">
        {view === 'home' && <HomeView inputValue={inputValue} setInputValue={setInputValue} isFocused={isFocused} setIsFocused={setIsFocused} handleStartAnalysis={handleStartAnalysis} />}
        {view === 'loading' && <LoadingView />}
        {view === 'map' && <MapView members={members} selectedMemberId={selectedMemberId} setSelectedMemberId={handleSelectMember} tempMember={tempMember} setTempMember={setTempMember} handleSaveMember={handleSaveMember} inputValue={inputValue} setView={(nextView) => setView(nextView)} />}
        {view === 'chat' && <ChatView messages={messages} members={members} chatInput={chatInput} setChatInput={setChatInput} handleSendMessage={handleSendMessage} handleAddMemberToInput={handleAddMemberToInput} setView={setView} inputValue={inputValue} chatEndRef={chatEndRef} />}
        {view === 'plan' && <PlanView setView={(nextView) => setView(nextView)} />}
      </AnimatePresence>
      <CustomCursor currentView={view} />
      {projectId && <span className="hidden">project:{projectId}</span>}
    </div>
  );
}
