'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/app/lib/supabase';
import type { CalibrationData } from '@/app/lib/types';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');

export default function AdminSnapshotsPage() {
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<CalibrationData['snapshots']>([]);
  const [loading, setLoading] = useState(false);
  const [snapshotCounts, setSnapshotCounts] = useState<Record<string, number>>({});

  // Load snapshot counts for all letters on mount
  useEffect(() => {
    loadSnapshotCounts();
  }, []);

  const loadSnapshotCounts = async () => {
    try {
      const { data, error } = await supabase
        .from('calibrations')
        .select('letter, pattern_data');

      if (error) throw error;

      const counts: Record<string, number> = {};
      data?.forEach((cal) => {
        const letter = cal.letter.toLowerCase();
        const snapshotCount = cal.pattern_data?.snapshots?.length || 0;
        counts[letter] = (counts[letter] || 0) + snapshotCount;
      });

      setSnapshotCounts(counts);
    } catch (error) {
      console.error('Error loading snapshot counts:', error);
    }
  };

  const loadSnapshots = async (letter: string) => {
    setLoading(true);
    setSelectedLetter(letter);

    try {
      // Load all calibrations for this letter (cross-profile)
      const { data, error } = await supabase
        .from('calibrations')
        .select('*')
        .eq('letter', letter.toLowerCase());

      if (error) throw error;

      // Collect all snapshots with calibration metadata
      const allSnapshots: Array<CalibrationData['snapshots'][0] & { calibrationId: string }> = [];
      data?.forEach((cal) => {
        if (cal.pattern_data?.snapshots) {
          cal.pattern_data.snapshots.forEach((snapshot: CalibrationData['snapshots'][0]) => {
            allSnapshots.push({
              ...snapshot,
              calibrationId: cal.id
            });
          });
        }
      });

      // Sort by score descending
      allSnapshots.sort((a, b) => (b.score || 0) - (a.score || 0));

      setSnapshots(allSnapshots);
    } catch (error) {
      console.error('Error loading snapshots:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteSnapshot = async (snapshot: any, index: number) => {
    if (!confirm('Are you sure you want to delete this snapshot?')) {
      return;
    }

    console.log('🗑️ Deleting snapshot:', {
      calibrationId: snapshot.calibrationId,
      profileId: snapshot.profileId,
      hasAudio: !!snapshot.audio_url
    });

    // Optimistic update - remove from UI immediately
    const updatedSnapshotList = snapshots.filter((_, idx) => idx !== index);
    setSnapshots(updatedSnapshotList);

    try {
      // Validate calibrationId
      if (!snapshot.calibrationId) {
        throw new Error('Snapshot is missing calibrationId');
      }

      // Get the calibration record
      const { data: calibration, error: fetchError } = await supabase
        .from('calibrations')
        .select('*')
        .eq('id', snapshot.calibrationId)
        .single();

      if (fetchError) {
        console.error('❌ Error fetching calibration:', fetchError);
        throw fetchError;
      }

      console.log('📦 Found calibration record, current snapshot count:', calibration.pattern_data?.snapshots?.length);

      // Find and remove the snapshot from the array
      const updatedSnapshots = calibration.pattern_data.snapshots.filter((s: any) => {
        // Match by profileId and pattern data (first few values)
        const isSameProfile = s.profileId === snapshot.profileId;
        const isSamePattern = s.data?.[0] === snapshot.data?.[0] &&
                             s.data?.[1] === snapshot.data?.[1] &&
                             s.data?.[2] === snapshot.data?.[2];
        const isSameAudio = s.audio_url === snapshot.audio_url;

        // Keep all snapshots that DON'T match
        return !(isSameProfile && isSamePattern && isSameAudio);
      });

      console.log('🔄 Updated snapshot count:', updatedSnapshots.length, '(removed', calibration.pattern_data.snapshots.length - updatedSnapshots.length, ')');

      // Update the calibration record
      const { error: updateError } = await supabase
        .from('calibrations')
        .update({
          pattern_data: {
            ...calibration.pattern_data,
            snapshots: updatedSnapshots
          }
        })
        .eq('id', snapshot.calibrationId);

      if (updateError) {
        console.error('❌ Error updating calibration:', updateError);
        throw updateError;
      }

      // Delete audio file from storage if it exists
      if (snapshot.audio_url) {
        try {
          // Extract the full storage path from the URL
          const urlParts = snapshot.audio_url.split('/storage/v1/object/public/snapshots/');
          if (urlParts.length > 1) {
            const storagePath = urlParts[1];
            console.log('🗑️ Deleting audio file:', storagePath);

            const { error: storageError } = await supabase.storage
              .from('snapshots')
              .remove([storagePath]);

            if (storageError) {
              console.warn('⚠️ Failed to delete audio file (non-fatal):', storageError);
            } else {
              console.log('✅ Audio file deleted');
            }
          }
        } catch (storageError) {
          console.warn('⚠️ Failed to delete audio file (non-fatal):', storageError);
        }
      }

      // Update snapshot counts in background (no reload, no scroll jump)
      loadSnapshotCounts();

      console.log('✅ Snapshot deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting snapshot:', error);
      // Restore snapshot on error
      setSnapshots(snapshots);
      alert(`Failed to delete snapshot: ${error instanceof Error ? error.message : 'Unknown error'}\nCheck console for details.`);
    }
  };

  return (
    <div className="mt-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-white text-center mb-6" style={{ textShadow: '0 4px 12px rgba(124,179,66,0.8)' }}>
        Snapshot Manager
      </h1>

      {/* Letter Grid */}
      <div className="bg-black/70 rounded-[30px] p-8 mb-6">
        <div className="text-[#d1d5db] text-sm mb-4 text-center">
          Select a letter to view all snapshots (showing all profiles):
        </div>
        <div className="grid grid-cols-9 gap-2 max-w-2xl mx-auto">
          {ALPHABET.map((letter) => {
            const count = snapshotCounts[letter] || 0;
            const isSelected = selectedLetter === letter;

            return (
              <button
                key={letter}
                onClick={() => loadSnapshots(letter)}
                className={`
                  relative w-14 h-14 rounded font-bold text-lg transition-all
                  ${isSelected
                    ? 'bg-[#7CB342] text-white scale-105 shadow-lg'
                    : count > 0
                      ? 'bg-white/20 text-white hover:bg-white/30'
                      : 'bg-white/5 text-gray-500'
                  }
                `}
                disabled={count === 0}
              >
                {letter.toUpperCase()}
                {count > 0 && (
                  <div className="absolute -top-1 -right-1 bg-green-600 text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {count}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Snapshots Display */}
      {selectedLetter && (
        <div className="bg-black/70 rounded-[30px] p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">
              Letter &apos;{selectedLetter.toUpperCase()}&apos; - {snapshots.length} Snapshots
            </h2>
            <button
              onClick={() => setSelectedLetter(null)}
              className="px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors"
            >
              Close
            </button>
          </div>

          {loading ? (
            <div className="text-center text-[#d1d5db] py-12">Loading snapshots...</div>
          ) : snapshots.length === 0 ? (
            <div className="text-center text-[#d1d5db] py-12">No snapshots found for this letter.</div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {snapshots.map((snapshot, idx) => (
                <SnapshotCard
                  key={`snapshot-${idx}`}
                  snapshot={snapshot}
                  index={idx}
                  onDelete={() => deleteSnapshot(snapshot, idx)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Individual snapshot card component
interface SnapshotCardProps {
  snapshot: {
    data: number[];
    score?: number;
    profileId: string;
    audio_url?: string;
    isNegative?: boolean;
  };
  index: number;
  onDelete: () => void;
}

function SnapshotCard({ snapshot, index, onDelete }: SnapshotCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!canvasRef.current || !snapshot.data) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.offsetWidth || 300;
    canvas.height = 80;

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

    setIsPlaying(true);

    // Play the snapshot audio
    audioRef.current = new Audio(snapshot.audio_url);
    audioRef.current.onended = () => setIsPlaying(false);
    audioRef.current.play().catch(err => {
      console.error('Error playing snapshot audio:', err);
      setIsPlaying(false);
    });
  };

  const isNegative = snapshot.isNegative || false;
  const borderColor = isNegative ? 'border-red-600' : 'border-green-600';
  const bgColor = isNegative ? 'bg-red-900/20' : 'bg-green-900/20';
  const textColor = isNegative ? 'text-red-400' : 'text-green-400';
  const label = isNegative ? '✗ NEGATIVE' : '✓ POSITIVE';

  return (
    <div className={`${borderColor} ${bgColor} border-2 rounded-lg p-4`}>
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className={`${textColor} text-sm font-bold`}>
            {label} #{index + 1}
          </div>
          <div className="text-[#999] text-xs mt-1">
            Score: {snapshot.score || 0} matches
          </div>
        </div>
        <div className="flex gap-2">
          {snapshot.audio_url && (
            <button
              onClick={playAudio}
              className={`px-3 py-1 rounded transition-colors ${
                isPlaying
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/40'
              }`}
              title="Play audio"
            >
              {isPlaying ? '⏸' : '▶'}
            </button>
          )}
          <button
            onClick={onDelete}
            className="px-3 py-1 rounded bg-red-600/20 text-red-400 hover:bg-red-600/40 transition-colors"
            title="Delete snapshot"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Profile Info */}
      <div className="text-[#999] text-xs mb-3">
        Profile: <span className="font-mono">{snapshot.profileId.substring(0, 12)}...</span>
      </div>

      {/* Pattern Visualization */}
      <canvas ref={canvasRef} className="w-full h-[80px] bg-black/30 rounded" />
    </div>
  );
}
