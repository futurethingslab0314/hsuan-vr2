import { motion } from 'motion/react';
import { TeamMember } from '../types';

export const RelationshipLines = ({ members }: { members: TeamMember[] }) => {
  const connections = (() => {
    if (members.length < 2) return [] as Array<[TeamMember, TeamMember]>;
    if (members.length === 2) return [[members[0], members[1]]] as Array<[TeamMember, TeamMember]>;

    return members.map((member, index) => [member, members[(index + 1) % members.length]] as [TeamMember, TeamMember]);
  })();

  const safeConnections = connections.filter(
    ([m1, m2]) => m1?.position && m2?.position
  );

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
      <defs>
        <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(0,0,0,0.05)" />
          <stop offset="50%" stopColor="rgba(0,0,0,0.15)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.05)" />
        </linearGradient>
      </defs>

      {safeConnections.map(([m1, m2], i) => (
        <motion.line
          key={i}
          x1={`${m1.position.x}%`}
          y1={`${m1.position.y}%`}
          x2={`${m2.position.x}%`}
          y2={`${m2.position.y}%`}
          stroke="url(#lineGradient)"
          strokeWidth="1.5"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ delay: 0.5 + i * 0.1, duration: 1 }}
        />
      ))}
    </svg>
  );
};
