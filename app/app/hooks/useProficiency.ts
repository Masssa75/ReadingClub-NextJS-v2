'use client';

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { LetterProficiency } from '@/app/lib/types';
import type { LetterStats } from '@/app/lib/types';
import { SESSION_CONFIG } from '@/app/lib/constants';

/**
 * Phase 5: Proficiency Management Hook
 *
 * Manages letter proficiency levels:
 * - Load proficiency from Supabase
 * - Update proficiency in database
 * - Calculate graduations (UNKNOWN → KNOWN → MASTERED)
 * - Calculate demotions (MASTERED → SOMETIMES/UNKNOWN)
 */

export function useProficiency(profileId: string | null) {
  const [proficiencies, setProficiencies] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  // Load all letter proficiencies from Supabase
  const loadProficiencies = useCallback(async () => {
    if (!profileId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('calibrations')
        .select('letter, proficiency')
        .eq('profile_id', profileId);

      if (error) throw error;

      const profMap: Record<string, number> = {};
      data?.forEach((row) => {
        profMap[row.letter] = row.proficiency ?? LetterProficiency.UNKNOWN;
      });

      setProficiencies(profMap);
      console.log('📊 Loaded proficiencies:', profMap);
    } catch (error) {
      console.error('❌ Error loading proficiencies:', error);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  // Load proficiencies when profile changes
  useEffect(() => {
    loadProficiencies();
  }, [loadProficiencies]);

  // Get proficiency for a specific letter
  const getProficiency = useCallback(
    (letter: string): number => {
      return proficiencies[letter] ?? LetterProficiency.UNKNOWN;
    },
    [proficiencies]
  );

  // Update proficiency for a single letter
  const updateProficiency = useCallback(
    async (letter: string, proficiency: number) => {
      if (!profileId) return;

      try {
        const { error } = await supabase
          .from('calibrations')
          .update({ proficiency })
          .eq('profile_id', profileId)
          .eq('letter', letter);

        if (error) throw error;

        // Update local state
        setProficiencies((prev) => ({
          ...prev,
          [letter]: proficiency,
        }));

        console.log(`📈 Updated proficiency: ${letter} → ${proficiency}`);
      } catch (error) {
        console.error(`❌ Error updating proficiency for ${letter}:`, error);
      }
    },
    [profileId]
  );

  // Batch update proficiencies from session end
  const updateProficienciesFromSession = useCallback(
    async (
      letterStats: Map<string, LetterStats>,
      lettersGraduated: string[]
    ) => {
      if (!profileId) return;

      console.log('🔄 Processing proficiency updates from session...');

      const updates: Array<{ letter: string; proficiency: number }> = [];

      for (const [letter, stats] of letterStats.entries()) {
        const currentProficiency = proficiencies[letter] ?? LetterProficiency.UNKNOWN;
        let newProficiency = currentProficiency;

        // Check for graduation to KNOWN
        if (lettersGraduated.includes(letter)) {
          newProficiency = LetterProficiency.KNOWN;
          console.log(`📈 ${letter}: UNKNOWN → KNOWN`);
        }

        // Check for graduation to MASTERED (from previous KNOWN)
        if (currentProficiency === LetterProficiency.KNOWN) {
          const firstThreeResults = stats.first_attempts_result.slice(0, 3);
          const correctCount = firstThreeResults.filter((r) => r === true).length;

          if (
            correctCount >= SESSION_CONFIG.GRADUATION_TEST_REQUIRED &&
            stats.listen_clicks === 0
          ) {
            newProficiency = LetterProficiency.MASTERED;
            console.log(`🌟 ${letter}: KNOWN → MASTERED`);
          }
        }

        // Check for demotion from MASTERED
        if (currentProficiency === LetterProficiency.MASTERED) {
          if (stats.listen_clicks >= SESSION_CONFIG.MASTERED_DEMOTION_LISTEN_CLICKS) {
            newProficiency = LetterProficiency.UNKNOWN;
            console.log(
              `📉 ${letter}: MASTERED → UNKNOWN (${stats.listen_clicks} LISTEN clicks)`
            );
          } else if (stats.listen_clicks === 1) {
            newProficiency = LetterProficiency.SOMETIMES;
            console.log(`📉 ${letter}: MASTERED → SOMETIMES (1 LISTEN click)`);
          }
        }

        // Check for demotion from KNOWN
        if (currentProficiency === LetterProficiency.KNOWN) {
          if (stats.listen_clicks >= SESSION_CONFIG.KNOWN_DEMOTION_LISTEN_CLICKS) {
            newProficiency = LetterProficiency.SOMETIMES;
            console.log(
              `📉 ${letter}: KNOWN → SOMETIMES (${stats.listen_clicks} LISTEN clicks)`
            );
          }
        }

        // Add to updates if changed
        if (newProficiency !== currentProficiency) {
          updates.push({ letter, proficiency: newProficiency });
        }
      }

      // Batch update to Supabase
      if (updates.length > 0) {
        console.log(`💾 Saving ${updates.length} proficiency updates to Supabase...`);

        for (const update of updates) {
          await updateProficiency(update.letter, update.proficiency);
        }

        console.log('✅ Proficiency updates complete');
      } else {
        console.log('ℹ️ No proficiency changes to save');
      }
    },
    [profileId, proficiencies, updateProficiency]
  );

  // Get letters by proficiency level
  const getLettersByProficiency = useCallback(
    (proficiency: LetterProficiency): string[] => {
      return Object.entries(proficiencies)
        .filter(([_, prof]) => prof === proficiency)
        .map(([letter, _]) => letter);
    },
    [proficiencies]
  );

  return {
    proficiencies,
    loading,
    getProficiency,
    updateProficiency,
    updateProficienciesFromSession,
    getLettersByProficiency,
    reload: loadProficiencies,
  };
}
