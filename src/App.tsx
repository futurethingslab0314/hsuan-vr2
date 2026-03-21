'use client';

import React, { useState, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Home } from 'lucide-react';
import { TeamMember } from './types';
import { DEFAULT_MEMBERS } from './constants';
import { PROJECT_STAGE_VALUES } from './constants/projectStages';
import { CustomCursor } from './components/CustomCursor';
import { HomeView } from './components/views/HomeView';
import { LoadingView } from './components/views/LoadingView';
import { MapView } from './components/views/MapView';
import { ChatView } from './components/views/ChatView';
import { PlanView } from './components/views/PlanView';

type ChatMessage = {
  memberId?: string;
  role: string;
  name: string;
  content: string;
  type: 'user' | 'bot';
};

type GeneratedMember = {
  member_id: string;
  member_name: string;
  role_type_ai: string;
  is_custom_role: boolean;
};

type GeneratedReport = {
  report_id: string;
  report_number: string;
  report_content: string;
};

function buildProjectSeed({
  projectRequirements,
  designGoals,
  currentPhase,
}: {
  projectRequirements: string;
  designGoals: string;
  currentPhase: string;
}) {
  const trimmedRequirements = projectRequirements.trim();
  const collapsed = trimmedRequirements.replace(/\s+/g, ' ');
  const shortTitle = collapsed.slice(0, 60);

  return {
    project: shortTitle || 'Untitled Project',
    input_prompt_user: trimmedRequirements,
    input_prompt_goal_user: designGoals.trim(),
    currentstage_user: currentPhase,
    status: 'draft',
  };
}

function mapGeneratedMembersToUi(members: GeneratedMember[]): TeamMember[] {
  return members.map((member, index) => {
    const fallback = DEFAULT_MEMBERS[index] ?? DEFAULT_MEMBERS[DEFAULT_MEMBERS.length - 1];
    return {
      id: member.member_id,
      name: member.member_name,
      role: member.role_type_ai,
      background: fallback.background,
      tasks: fallback.tasks,
      knowledge: fallback.knowledge,
      workflow: fallback.workflow,
      responseFormat: fallback.responseFormat,
      tone: fallback.tone,
      position: fallback.position,
    };
  });
}

function extractTaggedMemberIds(input: string, members: TeamMember[]): string[] {
  return members
    .filter((member) => input.includes(`@${member.name}`))
    .map((member) => member.id);
}

export default function App() {
  const [view, setView] = useState<'home' | 'loading' | 'map' | 'chat' | 'plan'>('home');
  const [projectRequirements, setProjectRequirements] = useState('');
  const [designGoals, setDesignGoals] = useState('');
  const [currentPhase, setCurrentPhase] = useState<(typeof PROJECT_STAGE_VALUES)[number]>('discover');
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>(DEFAULT_MEMBERS);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [tempMember, setTempMember] = useState<TeamMember | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [report, setReport] = useState<GeneratedReport | null>(null);
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

  const handleGeneratePlan = async () => {
    if (!projectId || isGeneratingPlan) return;

    setIsGeneratingPlan(true);
    setView('plan');

    try {
      const response = await fetch(`/api/projects/${projectId}/report/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await response.json();
      if (!response.ok || !data?.ok) {
        throw new Error(data?.detail || data?.error || 'Failed to generate report');
      }

      setReport({
        report_id: data.report_id,
        report_number: data.report_number,
        report_content: data.report_content,
      });
    } catch (error) {
      console.error('[handleGeneratePlan]', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert(`生成報告失敗: ${message}`);
      setView('chat');
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !projectId) return;

    const currentMessage = chatInput.trim();
    const taggedMembers = extractTaggedMemberIds(currentMessage, members);
    const newUserMessage: ChatMessage = { role: 'User', name: 'You', content: currentMessage, type: 'user' };
    setMessages((prev) => [...prev, newUserMessage]);
    setChatInput('');

    try {
      const response = await fetch(`/api/projects/${projectId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_message: currentMessage,
          tagged_members: taggedMembers,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data?.ok) {
        throw new Error(data?.detail || data?.error || 'Failed to process chat round');
      }

      const botMessages: ChatMessage[] = data.responses.map((item: { member_id: string; role_type_ai: string; member_name: string; content: string }) => ({
        memberId: item.member_id,
        role: item.role_type_ai,
        name: item.member_name,
        content: item.content,
        type: 'bot',
      }));

      const summaryMessage: ChatMessage = {
        role: 'System',
        name: 'System Summary',
        content: data.system_summary,
        type: 'bot',
      };

      setMessages((prev) => [...prev, ...botMessages, summaryMessage]);
    } catch (error) {
      console.error('[handleSendMessage]', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert(`對話處理失敗: ${message}`);
    }
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
    if (
      !projectRequirements.trim() ||
      !designGoals.trim() ||
      !currentPhase ||
      isCreatingProject
    ) {
      return;
    }

    setIsCreatingProject(true);
    setView('loading');
    setReport(null);

    try {
      const createPayload = buildProjectSeed({
        projectRequirements,
        designGoals,
        currentPhase,
      });
      const createResponse = await fetch('/api/projects/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createPayload),
      });
      const createData = await createResponse.json();
      if (!createResponse.ok || !createData?.ok) {
        throw new Error(createData?.detail || createData?.error || 'Failed to create project');
      }

      const nextProjectId = createData.project_id as string;
      setProjectId(nextProjectId);

      const analyzeResponse = await fetch(`/api/projects/${nextProjectId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const analyzeData = await analyzeResponse.json();
      if (!analyzeResponse.ok || !analyzeData?.ok) {
        throw new Error(analyzeData?.detail || analyzeData?.error || 'Failed to analyze project');
      }

      const teamResponse = await fetch(`/api/projects/${nextProjectId}/team-members/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const teamData = await teamResponse.json();
      if (!teamResponse.ok || !teamData?.ok) {
        throw new Error(teamData?.detail || teamData?.error || 'Failed to generate team members');
      }

      setMembers(mapGeneratedMembersToUi(teamData.members));
      setMessages([]);
      setView('map');
    } catch (error) {
      console.error('[handleStartAnalysis]', error);
      setView('home');
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert(`建立、分析或生成團隊失敗: ${message}`);
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
        {view === 'home' && <HomeView projectRequirements={projectRequirements} setProjectRequirements={setProjectRequirements} designGoals={designGoals} setDesignGoals={setDesignGoals} currentPhase={currentPhase} setCurrentPhase={setCurrentPhase} isFocused={isFocused} setIsFocused={setIsFocused} handleStartAnalysis={handleStartAnalysis} />}
        {view === 'loading' && <LoadingView />}
        {view === 'map' && <MapView members={members} selectedMemberId={selectedMemberId} setSelectedMemberId={handleSelectMember} tempMember={tempMember} setTempMember={setTempMember} handleSaveMember={handleSaveMember} inputValue={projectRequirements} setView={(nextView) => setView(nextView)} />}
        {view === 'chat' && <ChatView messages={messages} members={members} chatInput={chatInput} setChatInput={setChatInput} handleSendMessage={handleSendMessage} handleAddMemberToInput={handleAddMemberToInput} setView={setView} handleGeneratePlan={handleGeneratePlan} isGeneratingPlan={isGeneratingPlan} inputValue={projectRequirements} chatEndRef={chatEndRef} />}
        {view === 'plan' && <PlanView setView={(nextView) => setView(nextView)} reportNumber={report?.report_number ?? null} reportContent={report?.report_content ?? null} isGeneratingPlan={isGeneratingPlan} />}
      </AnimatePresence>
      <CustomCursor currentView={view} />
      {projectId && <span className="hidden">project:{projectId}</span>}
    </div>
  );
}
