export interface TeamMember {
  id: string;
  name: string;
  role: string;
  background: {
    years: string;
    experience: string;
    profession: string;
    expertise: string;
  };
  tasks: string;
  knowledge: string;
  workflow: string;
  responseFormat: string;
  tone: string;
  position: { x: number; y: number };
}
