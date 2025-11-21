'use client';

import type { SessionData } from '@/app/lib/types';
import { LetterProficiency } from '@/app/lib/types';
import { SESSION_CONFIG } from '@/app/lib/constants';

/**
 * Phase 5: Letter Progress Tracker Component
 *
 * Displays visual progress bars for letters currently being practiced.
 * Shows progress toward next proficiency level:
 * - UNKNOWN/SOMETIMES → KNOWN (10 consecutive successes)
 * - KNOWN → MASTERED (first 3 attempts of next session)
 * - MASTERED ✓ (no further progress)
 */

interface LetterProgressTrackerProps {
  session: SessionData | null;
  proficiencies: Record<string, number>;
}

export default function LetterProgressTracker({
  session,
  proficiencies,
}: LetterProgressTrackerProps) {
  if (!session || session.newLettersIntroduced.length === 0) {
    return null; // Hide if no session or no letters introduced
  }

  return (
    <div className="mb-5 p-4 bg-white/5 rounded-lg">
      <div className="text-sm text-gray-400 mb-3">Letters in Practice:</div>
      <div className="flex gap-3 flex-wrap">
        {session.newLettersIntroduced.map((letter) => {
          const stats = session.letterStats.get(letter);
          if (!stats) return null;

          // Check if graduated in current session first, then fall back to database proficiency
          let currentProficiency = proficiencies[letter] ?? LetterProficiency.UNKNOWN;

          // If graduated to KNOWN in this session, update proficiency locally
          if (session.lettersGraduated.includes(letter)) {
            currentProficiency = LetterProficiency.KNOWN;
          }

          const rawProgress = stats.consecutive_success_no_listen || 0;

          // Always show progress toward NEXT level (not current achievement)
          let target: number | null;
          let nextLevel: string;
          let progress: number;
          let showProgressBar: boolean;

          if (currentProficiency === LetterProficiency.MASTERED) {
            // Already at max level
            target = null;
            nextLevel = 'MASTERED ✓';
            progress = 0;
            showProgressBar = false;
          } else if (currentProficiency === LetterProficiency.KNOWN) {
            // Show progress toward MASTERED
            // Note: MASTERED requires first 3 attempts of NEXT session to be perfect
            // But we can still show current session progress
            target = SESSION_CONFIG.GRADUATION_THRESHOLD; // Show progress toward 10
            nextLevel = 'MASTERED';
            progress = Math.min(rawProgress, target);
            showProgressBar = true;
          } else {
            // UNKNOWN or SOMETIMES - show progress toward KNOWN
            target = SESSION_CONFIG.GRADUATION_THRESHOLD;
            nextLevel = 'KNOWN';

            // If already at or past threshold, show as ready for next level
            if (rawProgress >= target) {
              // Ready to graduate to KNOWN, continue showing progress toward MASTERED
              progress = target; // Show as full (10/10)
            } else {
              progress = rawProgress;
            }
            showProgressBar = true;
          }

          const percentage = target ? Math.round((progress / target) * 100) : 100;
          const progressText = target ? `${progress}/${target} to ${nextLevel}` : nextLevel;

          return (
            <div
              key={letter}
              className="bg-white/8 rounded-md p-3 min-w-[130px] flex-shrink-0"
            >
              <div className={`flex items-center gap-2 ${showProgressBar ? 'mb-1.5' : ''}`}>
                <div className="text-xl font-bold text-yellow-400">{letter}</div>
                <div className="text-xs text-gray-400">{progressText}</div>
              </div>
              {showProgressBar && (
                <div className="bg-black/30 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-[#7CB342] h-full transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
