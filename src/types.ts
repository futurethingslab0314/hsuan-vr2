export interface TeamMember {
  id: string;
  name: string;
  role: 'PM' | 'Researcher' | 'UX Designer' | 'Engineer';
  roleBackgroundIdentity: string;
  roleTarget: string;
  roleKnowledgeReference: string;
  roleRules: string;
  roleWorkflow: string;
  roleResponseFormat: string;
  roleTone: string;
  position: { x: number; y: number };
}
