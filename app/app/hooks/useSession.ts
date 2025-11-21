'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { SessionData, LetterStats } from '@/app/lib/types';
import { SESSION_CONFIG } from '@/app/lib/constants';

/**
 * Phase 5: Session Management Hook
 *
 * Manages session lifecycle:
 * - Initialize new session or resume existing
 * - Track attempts and letter statistics
 * - Handle 30-minute timeout
 * - Save session data to localStorage
 * - End session and flush proficiency updates to Supabase
 */

export function useSession(profileId: string | null) {
  const [currentSession, setCurrentSession] = useState<SessionData | null>(null);
  const sessionRef = useRef<SessionData | null>(null);

  // Save session data to localStorage (defined first to avoid forward reference)
  const saveSessionData = useCallback((session: SessionData, profileId: string) => {
    if (!session) return;

    const sessionKey = `session_${profileId}`;

    // Convert Map to object for JSON serialization
    const serialized = {
      ...session,
      letterStats: Object.fromEntries(session.letterStats),
    };

    localStorage.setItem(sessionKey, JSON.stringify(serialized));
  }, []);

  // Initialize new session or resume existing
  const initSession = useCallback((profileId: string): SessionData => {
    const now = new Date();
    const sessionKey = `session_${profileId}`;
    const existingData = localStorage.getItem(sessionKey);

    // Try to resume existing session
    if (existingData) {
      try {
        const parsed = JSON.parse(existingData);
        const lastActivity = new Date(parsed.lastActivityTime);
        const minutesSinceActivity = (now.getTime() - lastActivity.getTime()) / 1000 / 60;

        if (minutesSinceActivity < SESSION_CONFIG.TIMEOUT_MINUTES) {
          // Resume session
          console.log(`📝 Resuming session from ${minutesSinceActivity.toFixed(1)} minutes ago`);

          // Convert letterStats from object to Map
          const letterStats = new Map<string, LetterStats>(
            Object.entries(parsed.letterStats || {})
          );

          const session: SessionData = {
            ...parsed,
            startTime: new Date(parsed.startTime),
            lastActivityTime: now,
            letterStats,
          };

          saveSessionData(session, profileId);
          return session;
        } else {
          // Session expired - end it
          console.log(`⏰ Session expired (${minutesSinceActivity.toFixed(1)} minutes old)`);
          const expiredSession: SessionData = {
            ...parsed,
            letterStats: new Map(Object.entries(parsed.letterStats || {})),
          };
          // End session will be handled by useProficiency hook
        }
      } catch (error) {
        console.error('❌ Error parsing session data:', error);
      }
    }

    // Create new session
    const newSession: SessionData = {
      sessionId: `session_${Date.now()}`,
      profileId,
      startTime: now,
      lastActivityTime: now,
      attempts: [],
      letterStats: new Map(),
      newLettersIntroduced: [],
      unknownLettersIntroduced: [],
      lettersGraduated: [],
      recentHistory: [],
    };

    console.log('🆕 Created new session:', newSession.sessionId);
    saveSessionData(newSession, profileId);
    return newSession;
  }, [saveSessionData]);

  // Initialize or resume session when profile changes
  useEffect(() => {
    if (!profileId) {
      setCurrentSession(null);
      sessionRef.current = null;
      return;
    }

    const session = initSession(profileId);
    setCurrentSession(session);
    sessionRef.current = session;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  // Record an attempt and update letter statistics
  const recordAttempt = useCallback((
    letter: string,
    success: boolean,
    clickedListen: boolean
  ) => {
    if (!sessionRef.current || !profileId) {
      console.warn('⚠️ No active session');
      return;
    }

    const session = sessionRef.current;
    const now = new Date();

    // Update last activity time
    session.lastActivityTime = now;

    // Record attempt
    session.attempts.push({
      letter,
      success,
      clickedListen,
      timestamp: now,
    });

    // Update recent history (last 3 letters)
    session.recentHistory.push(letter);
    if (session.recentHistory.length > 3) {
      session.recentHistory.shift();
    }

    // Get or create letter stats
    let stats = session.letterStats.get(letter);
    if (!stats) {
      stats = {
        attempts: [],
        listen_clicks: 0,
        first_attempts_result: [],
        consecutive_success_no_listen: 0,
        rapid_reps_remaining: 0,
        state: 'normal',
      };
      session.letterStats.set(letter, stats);
    }

    // Update stats
    stats.attempts.push(success);

    if (clickedListen) {
      stats.listen_clicks++;
      // Start rapid reinforcement: 3 reps after LISTEN
      stats.rapid_reps_remaining = SESSION_CONFIG.RAPID_REP_COUNT;
    }

    // Track first 3 attempts for graduation test (MASTERED)
    if (stats.first_attempts_result.length < SESSION_CONFIG.GRADUATION_TEST_ATTEMPTS) {
      stats.first_attempts_result.push(success && !clickedListen);
    }

    // Track consecutive successes without LISTEN for graduation to KNOWN
    if (success && !clickedListen) {
      stats.consecutive_success_no_listen++;
    } else {
      stats.consecutive_success_no_listen = 0;
    }

    // Check for graduation to KNOWN in this session
    if (
      session.newLettersIntroduced.includes(letter) &&
      !session.lettersGraduated.includes(letter) &&
      stats.consecutive_success_no_listen >= SESSION_CONFIG.GRADUATION_THRESHOLD
    ) {
      stats.state = 'graduated_to_known';
      session.lettersGraduated.push(letter);
      console.log(`🎓 ${letter} graduated to KNOWN!`);

      // Remove from unknown letters list (frees up slot for new UNKNOWN letter)
      const index = session.unknownLettersIntroduced.indexOf(letter);
      if (index > -1) {
        session.unknownLettersIntroduced.splice(index, 1);
        console.log(
          `✨ Freed up slot - can now introduce another UNKNOWN letter (${session.unknownLettersIntroduced.length}/${SESSION_CONFIG.MAX_NEW_LETTERS_PER_SESSION})`
        );
      }
    }

    // Decrement rapid reps if active
    if (stats.rapid_reps_remaining > 0) {
      stats.rapid_reps_remaining--;
    }

    saveSessionData(session, profileId);
    console.log(
      `📝 Recorded attempt: ${letter} ${success ? '✅' : '❌'} ${clickedListen ? '🔊' : ''} (${stats.consecutive_success_no_listen} streak)`
    );

    // Update state to trigger re-renders
    setCurrentSession({ ...session });
    sessionRef.current = session;
  }, [profileId, saveSessionData]);

  // Get current session data
  const getSession = useCallback(() => {
    return sessionRef.current;
  }, []);

  // End session and return letter stats for proficiency updates
  const endSession = useCallback(() => {
    if (!sessionRef.current) {
      console.warn('⚠️ No active session to end');
      return null;
    }

    const session = sessionRef.current;
    console.log('🏁 Ending session:', session.sessionId);

    // Clear session from localStorage
    if (profileId) {
      localStorage.removeItem(`session_${profileId}`);
    }

    // Return letter stats for proficiency updates
    const letterStats = session.letterStats;
    const lettersGraduated = session.lettersGraduated;

    // Clear current session
    setCurrentSession(null);
    sessionRef.current = null;

    return {
      letterStats,
      lettersGraduated,
      sessionId: session.sessionId,
    };
  }, [profileId]);

  return {
    currentSession,
    recordAttempt,
    getSession,
    endSession,
  };
}
