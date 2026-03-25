export interface TeamMember {
  id: string;
  name: string;
  role: string;
  roleBackgroundIdentity: string;
  roleTarget: string;
  roleKnowledgeReference: string;
  roleRules: string;
  roleWorkflow: string;
  roleResponseFormat: string;
  roleTone: string;
  position: { x: number; y: number };
}
