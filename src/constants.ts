import { TeamMember } from './types';

export const DEFAULT_MEMBERS: TeamMember[] = [
  {
    id: '1',
    name: 'Alex Chen',
    role: 'Researcher',
    roleBackgroundIdentity: 'UX researcher focused on user insight synthesis, pain-point discovery, and behavioral interpretation.',
    roleTarget: 'Define user journeys, identify pain points, and align design goals with business metrics.',
    roleKnowledgeReference: 'Nielsen Norman Group heuristics, ISO 9241-210, Jobs-to-be-Done framework.',
    roleRules: 'Keep recommendations grounded in user needs, evidence, and usability impact.',
    roleWorkflow: 'Works with PM to frame research questions, then collaborates with design and engineering to ground the team in validated user understanding.',
    roleResponseFormat: 'Structured reports with bullet points, journey maps, and prioritized action items.',
    roleTone: 'Analytical, professional, and user-centric.',
    position: { x: 50, y: 15 }
  },
  {
    id: '2',
    name: 'Sarah Miller',
    role: 'UX Designer',
    roleBackgroundIdentity: 'UX designer focused on interaction quality, visual consistency, and intuitive user flows.',
    roleTarget: 'Create high-fidelity mockups, maintain the design system, and ensure visual consistency.',
    roleKnowledgeReference: 'Material Design 3, Apple Human Interface Guidelines, WCAG 2.1 Accessibility.',
    roleRules: 'Keep interfaces coherent, accessible, and visually intentional.',
    roleWorkflow: 'Receives clarified user and product direction, then shapes interface structure and interaction flow before handing off implementation-ready design guidance.',
    roleResponseFormat: 'Visual specs, Figma components, and style guides.',
    roleTone: 'Creative, detail-oriented, and aesthetic.',
    position: { x: 85, y: 50 }
  },
  {
    id: '3',
    name: 'David Park',
    role: 'Engineer',
    roleBackgroundIdentity: 'Engineer focused on translating product concepts into robust, feasible, and testable implementations.',
    roleTarget: 'Build interactive prototypes, test complex animations, and bridge the gap between design and code.',
    roleKnowledgeReference: 'React documentation, Motion API, Browser performance standards.',
    roleRules: 'Keep implementation suggestions realistic, incremental, and maintainable.',
    roleWorkflow: 'Evaluates feasibility after product and design framing, then translates ideas into technical options, delivery constraints, and implementation steps.',
    roleResponseFormat: 'Interactive code snippets, sandbox links, and performance reports.',
    roleTone: 'Technical, pragmatic, and solution-focused.',
    position: { x: 50, y: 85 }
  },
  {
    id: '4',
    name: 'Elena Rodriguez',
    role: 'PM',
    roleBackgroundIdentity: 'Product manager focused on goals, prioritization, scope control, and delivery alignment.',
    roleTarget: 'Prioritize features, manage the product backlog, and ensure the team meets deadlines.',
    roleKnowledgeReference: 'Scrum Guide, OKR methodology, Product-led growth principles.',
    roleRules: 'Balance user value, business impact, and engineering feasibility in every decision.',
    roleWorkflow: 'Coordinates the team by connecting research insights, design direction, and engineering feasibility into a coherent product path.',
    roleResponseFormat: 'Product requirement summaries, milestone plans, and roadmap recommendations.',
    roleTone: 'Decisive, organized, and strategic.',
    position: { x: 15, y: 50 }
  }
];

export const ROLE_TAGS: Record<
  TeamMember['role'],
  { target: string[]; tone: string[]; format: string[]; knowledge: string[] }
> = {
  PM: {
    target: ['#商業價值最大化', '#MVP範疇管控', '#產品成功指標', '#需求優先級排序'],
    tone: ['#理性務實', '#目標導向', '#決斷果敢', '#尖酸刻薄', '#客觀事實', '#溫和'],
    format: ['#功能需求矩陣', '#發展藍圖規劃', '#成本效益分析', '#結構化任務清單'],
    knowledge: ['#市場趨勢分析', '#商業模式設計', '#敏捷專案管理', '#利害關係人協調', '#Scrum 框架', '#用戶路徑User Flow'],
  },
  Researcher: {
    target: ['#使用者痛點挖掘', '#假設科學驗證', '#文化脈絡分析', '#倫理風險監控'],
    tone: ['#客觀中立', '#嚴謹細緻', '#具共情力', '#警覺防範', '#溫和引導性', '#敘事感強烈'],
    format: ['#用戶旅程圖', '#同理心地圖', '#分析矩陣', '#設計原則', '#條列式分析'],
    knowledge: ['#人因工程學', '#行為經濟學', '#質性與量化研究', '#用戶心理模型', '#親和圖', '#主題分析法', '#認知心理學', '#批判性思考'],
  },
  'UX Designer': {
    target: ['#建立流暢互動流程', '#情感連結建立', '#設計規範系統', '#確保產品易用性'],
    tone: ['#富聯想力', '#注重細節', '#審美挑惕', '#以人為本', '#引用設計術語', '#溫柔', '#堅定'],
    format: ['#用戶流程圖', '#互動動線腳本', '#設計規範', '#資訊架構'],
    knowledge: ['#資訊架構', '#用戶路徑與流程', '#可用性測試', '#物理與數位互動整合', '#設計原則'],
  },
  Engineer: {
    target: ['#系統架構穩健性', '#技術可行性評估', '#開發工期精算', '#效能與安全優化'],
    tone: ['#實事求是', '#邏輯嚴密', '#條理分明', '#冷靜防衛', '#技術導向'],
    format: ['#技術規格書', '#API介面規格', '#風險與技術債稽核', '#開發時程估算', '#條列式說明', '#系統架構圖'],
    knowledge: ['#軟硬體整合技術', '#通訊架構', '#資安防護規範', '#軟體生命週期管理', '#資料結構與演算法', '#感測器、ESP32、Arduino'],
  },
};
