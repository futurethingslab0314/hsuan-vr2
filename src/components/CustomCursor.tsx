import React, { useState, useEffect, useRef } from 'react';
import { MousePointer2 } from 'lucide-react';

export const CustomCursor = ({ currentView }: { currentView: string }) => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isClicked, setIsClicked] = useState(false);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [trail, setTrail] = useState<{ x: number; y: number; id: number; timestamp: number }[]>([]);
  const trailIdRef = useRef(0);
  const lastPosRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
      if (currentView === 'home') {
        const dist = Math.hypot(e.clientX - lastPosRef.current.x, e.clientY - lastPosRef.current.y);
        if (dist > 15) {
          setTrail((prev) => [...prev, { x: e.clientX, y: e.clientY, id: trailIdRef.current++, timestamp: Date.now() }]);
          lastPosRef.current = { x: e.clientX, y: e.clientY };
        }
      }
    };

    const handleMouseDown = () => setIsClicked(true);
    const handleMouseUp = () => setIsClicked(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [currentView]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      setNowTs(now);
      setTrail((prev) => prev.filter((p) => now - p.timestamp < 1500));
    }, 50);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999]">
      {currentView === 'home' && (
        <svg className="absolute inset-0 w-full h-full">
          <g fill="none" stroke="#8E8E93" strokeWidth="1">
            {trail.map((point) => {
              const age = nowTs - point.timestamp;
              const progress = age / 1500;
              const opacity = Math.max(0, 0.35 * (1 - progress));

              return (
                <React.Fragment key={point.id}>
                  <circle cx={point.x + 12} cy={point.y + 12} r={progress * 40} strokeOpacity={opacity} />
                  <circle cx={point.x + 12} cy={point.y + 12} r={progress * 25} strokeOpacity={opacity * 0.6} />
                </React.Fragment>
              );
            })}
          </g>
        </svg>
      )}

      <div className="absolute transition-colors duration-100" style={{ left: mousePos.x, top: mousePos.y, transform: 'translate(-2px, -2px) rotate(-15deg)', color: isClicked ? '#FF4500' : '#000000' }}>
        <MousePointer2 size={32} fill="currentColor" stroke="white" strokeWidth={1} />
      </div>
    </div>
  );
};
