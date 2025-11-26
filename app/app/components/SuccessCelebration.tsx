'use client';

import { useEffect, useState } from 'react';

interface SuccessCelebrationProps {
  letter: string;
  onComplete?: () => void;
}

export default function SuccessCelebration({ letter, onComplete }: SuccessCelebrationProps) {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; vx: number; vy: number; color: string; isCircle: boolean }>>([]);

  useEffect(() => {
    // Play success sound (matches HTML version)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContext) {
      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // C-E-G major chord (rising)
      oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
      oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
      oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.4);
    }

    // Create confetti particles
    const colors = ['#FDD835', '#7CB342', '#00BCD4', '#FF5722', '#9C27B0'];
    const newParticles = [];

    for (let i = 0; i < 20; i++) {
      const angle = (Math.PI * 2 * i) / 20;
      const velocity = 100 + Math.random() * 100; // pixels per second
      newParticles.push({
        id: i,
        x: 0,
        y: 0,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        color: colors[Math.floor(Math.random() * colors.length)],
        isCircle: Math.random() > 0.5,
      });
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setParticles(newParticles);

    // Clean up after animation completes
    const cleanup = setTimeout(() => {
      setParticles([]);
      if (onComplete) onComplete();
    }, 1000);

    return () => clearTimeout(cleanup);
  }, [letter, onComplete]);

  return (
    <>
      {/* Letter Animation */}
      <style jsx>{`
        @keyframes letterSuccess {
          0% {
            transform: scale(1);
            color: #FDD835;
          }
          20% {
            transform: scale(1.2);
            color: #7CB342;
          }
          40% {
            transform: scale(1.3);
            color: #00BCD4;
          }
          60% {
            transform: scale(1.4);
            color: #9C27B0;
          }
          100% {
            transform: scale(1);
            color: #FDD835;
          }
        }

        .success-letter {
          animation: letterSuccess 0.8s ease-out;
        }

        @keyframes confettiFall {
          0% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }

        .confetti-particle {
          animation: confettiFall 1s ease-out forwards;
        }
      `}</style>

      {/* Confetti Particles */}
      {particles.map((particle) => (
        <ConfettiParticle
          key={particle.id}
          x={particle.x}
          y={particle.y}
          vx={particle.vx}
          vy={particle.vy}
          color={particle.color}
          isCircle={particle.isCircle}
        />
      ))}
    </>
  );
}

interface ConfettiParticleProps {
  x: number;
  y: number;
  vx: number; // velocity x (pixels/second)
  vy: number; // velocity y (pixels/second)
  color: string;
  isCircle: boolean;
}

function ConfettiParticle({ x: initialX, y: initialY, vx, vy, color, isCircle }: ConfettiParticleProps) {
  const [position, setPosition] = useState({ x: initialX, y: initialY, rotation: 0, opacity: 1 });

  useEffect(() => {
    const gravity = 500; // pixels/second²
    const startTime = Date.now();

    const animate = () => {
      const elapsed = (Date.now() - startTime) / 1000; // seconds
      const x = vx * elapsed;
      const y = vy * elapsed + 0.5 * gravity * elapsed * elapsed;
      const rotation = elapsed * 360;
      const opacity = Math.max(0, 1 - elapsed * 1.5);

      setPosition({ x, y, rotation, opacity });

      if (elapsed < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [vx, vy]);

  return (
    <div
      className="confetti-particle fixed pointer-events-none"
      style={{
        left: '50%',
        top: '50%',
        width: '10px',
        height: '10px',
        backgroundColor: color,
        borderRadius: isCircle ? '50%' : '0',
        transform: `translate(${position.x}px, ${position.y}px) rotate(${position.rotation}deg)`,
        opacity: position.opacity,
        zIndex: 9999,
      }}
    />
  );
}
