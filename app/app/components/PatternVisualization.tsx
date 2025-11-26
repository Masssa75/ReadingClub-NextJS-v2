'use client';

import { useEffect, useRef } from 'react';
import type { CalibrationData } from '@/app/lib/types';

interface PatternVisualizationProps {
  currentLetter: string | null;
  calibrationData: Record<string, CalibrationData> | null;
  currentPattern: number[] | null;
}

export default function PatternVisualization({
  currentLetter,
  calibrationData,
  currentPattern
}: PatternVisualizationProps) {
  const storedCanvasRef = useRef<HTMLCanvasElement>(null);
  const currentCanvasRef = useRef<HTMLCanvasElement>(null);

  // Draw pattern on canvas
  const drawPattern = (canvas: HTMLCanvasElement, pattern: number[]) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, width, height);

    if (!pattern || pattern.length === 0) return;

    // Skip drawing if pattern is too quiet (max < 1.0)
    const max = Math.max(...pattern);
    if (max < 1.0) return;

    // Normalize pattern for visualization
    const normalized = pattern.map(v => v / max);

    // Draw bars with color gradient
    const barWidth = width / normalized.length;
    normalized.forEach((value, i) => {
      const barHeight = value * height;
      const hue = (i / normalized.length) * 120 + 100; // Green to purple gradient
      ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
      ctx.fillRect(i * barWidth, height - barHeight, barWidth - 1, barHeight);
    });
  };

  // Update stored pattern when letter changes
  useEffect(() => {
    if (!storedCanvasRef.current || !currentLetter || !calibrationData) return;

    const canvas = storedCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions
    canvas.width = canvas.offsetWidth || 400;
    canvas.height = 80;

    // Normalize letter to lowercase for consistent key access
    const normalizedLetter = currentLetter.toLowerCase();
    const letterData = calibrationData[normalizedLetter];
    if (!letterData || !letterData.snapshots || letterData.snapshots.length === 0) {
      // Clear canvas if no data
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }

    // Get first positive snapshot
    const firstPositive = letterData.snapshots.find(s => !s.isNegative);
    if (!firstPositive || !firstPositive.data) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }

    drawPattern(canvas, firstPositive.data);
  }, [currentLetter, calibrationData]);

  // Update current pattern (live updates)
  useEffect(() => {
    if (!currentCanvasRef.current || !currentPattern) return;

    const canvas = currentCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions
    canvas.width = canvas.offsetWidth || 400;
    canvas.height = 80;

    drawPattern(canvas, currentPattern);
  }, [currentPattern]);

  // Get pattern count for current letter
  const getPatternCount = () => {
    if (!currentLetter || !calibrationData) return '-';

    // Normalize letter to lowercase for consistent key access
    const normalizedLetter = currentLetter.toLowerCase();
    const letterData = calibrationData[normalizedLetter];
    if (!letterData || !letterData.snapshots) return '-';

    const posCount = letterData.snapshots.filter(s => !s.isNegative).length;
    const negCount = letterData.snapshots.filter(s => s.isNegative).length;

    if (negCount > 0) {
      return `${posCount} positive, ${negCount} negative`;
    }
    return `${posCount} positive`;
  };

  // Get all snapshots for display
  const getAllSnapshots = () => {
    if (!currentLetter || !calibrationData) return { positive: [], negative: [] };

    const normalizedLetter = currentLetter.toLowerCase();
    const letterData = calibrationData[normalizedLetter];
    if (!letterData || !letterData.snapshots) return { positive: [], negative: [] };

    const positive = letterData.snapshots.filter(s => !s.isNegative);
    const negative = letterData.snapshots.filter(s => s.isNegative);

    return { positive, negative };
  };

  const { positive: positiveSnapshots, negative: negativeSnapshots } = getAllSnapshots();

  return (
    <div className="mt-5">
      {/* Main Comparison */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Stored Pattern */}
        <div className="bg-black/30 p-4 rounded-[10px]">
          <div className="text-[#aaa] text-[11px] mb-2 text-center">
            📦 Stored Calibration
          </div>
          <canvas
            ref={storedCanvasRef}
            className="w-full h-20 bg-black/30 rounded-[5px]"
          />
          <div className="text-[#999] text-[10px] mt-1 text-center">
            {getPatternCount()}
          </div>
        </div>

        {/* Current Pattern */}
        <div className="bg-black/30 p-4 rounded-[10px]">
          <div className="text-[#aaa] text-[11px] mb-2 text-center">
            🎤 Current Recording
          </div>
          <canvas
            ref={currentCanvasRef}
            className="w-full h-20 bg-black/30 rounded-[5px]"
          />
        </div>
      </div>

      {/* All Snapshots Display */}
      {(positiveSnapshots.length > 0 || negativeSnapshots.length > 0) && (
        <div className="mt-6">
          <div className="text-[#ddd] text-sm font-bold mb-3">Additional Training Patterns:</div>

          <div className="grid grid-cols-3 gap-3">
            {/* Positive Snapshots */}
            {positiveSnapshots.map((snapshot, idx) => (
              <SnapshotCard
                key={`pos-${idx}`}
                snapshot={snapshot}
                index={idx}
                isNegative={false}
              />
            ))}

            {/* Negative Snapshots */}
            {negativeSnapshots.map((snapshot, idx) => (
              <SnapshotCard
                key={`neg-${idx}`}
                snapshot={snapshot}
                index={idx}
                isNegative={true}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Individual snapshot card component
interface SnapshotCardProps {
  snapshot: { data: number[]; score?: number; profileId: string; audio_url?: string };
  index: number;
  isNegative: boolean;
}

function SnapshotCard({ snapshot, index, isNegative }: SnapshotCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !snapshot.data) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.offsetWidth || 300;
    canvas.height = 60;

    // Clear canvas
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const max = Math.max(...snapshot.data);
    if (max < 1.0) return;

    // Normalize and draw
    const normalized = snapshot.data.map(v => v / max);
    const barWidth = canvas.width / normalized.length;

    normalized.forEach((value, i) => {
      const barHeight = value * canvas.height;
      const hue = (i / normalized.length) * 120 + 100;
      ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
      ctx.fillRect(i * barWidth, canvas.height - barHeight, barWidth - 1, barHeight);
    });
  }, [snapshot.data]);

  const playAudio = () => {
    if (!snapshot.audio_url) return;

    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    // Play the snapshot audio
    audioRef.current = new Audio(snapshot.audio_url);
    audioRef.current.play().catch(err => {
      console.error('Error playing snapshot audio:', err);
    });
  };

  const borderColor = isNegative ? 'border-red-600' : 'border-green-600';
  const bgColor = isNegative ? 'bg-red-900/10' : 'bg-green-900/10';
  const textColor = isNegative ? 'text-red-400' : 'text-green-400';
  const label = isNegative ? `✗ NEGATIVE #${index + 1}` : `✓ POSITIVE #${index + 1}`;

  return (
    <div className={`${borderColor} ${bgColor} border-2 rounded-lg p-3`}>
      <div className={`${textColor} text-[11px] font-bold mb-1 text-center`}>
        {label}
      </div>
      <div className="text-[#999] text-[10px] mb-2 text-center flex items-center justify-center gap-2">
        <span>✓ {snapshot.score || 0} matches | Profile: {snapshot.profileId.substring(0, 8)}</span>
        {snapshot.audio_url && (
          <button
            onClick={playAudio}
            className="text-blue-400 hover:text-blue-300 transition-colors"
            title="Play audio"
          >
            ▶
          </button>
        )}
      </div>
      <canvas ref={canvasRef} className="w-full h-[60px] bg-black/30 rounded" />
    </div>
  );
}
