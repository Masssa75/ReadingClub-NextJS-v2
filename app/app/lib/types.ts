// TypeScript interfaces for ReadingClub audio engine

export interface AudioEngineState {
  audioContext: AudioContext | null;
  analyser: AnalyserNode | null;
  microphone: MediaStreamAudioSourceNode | null;
  dataArray: Uint8Array | null;
  stream: MediaStream | null;
}

export interface Snapshot {
  data: number[]; // 64-bin normalized pattern (0-1 range)
  profileId: string;
  isNegative: boolean;
  isGlobalNegative?: boolean; // When true, this negative applies to ALL letters (e.g., rain, background noise)
  score: number;
  audio_url?: string; // Optional audio recording of the snapshot
  createdAt?: string; // Timestamp when snapshot was created
}

export interface CalibrationData {
  snapshots: Snapshot[];
}

export interface MatchInfo {
  target: string;
  positiveSnapshot: Snapshot | null;
  positiveScore: number;
  negativeSnapshot: Snapshot | null;
  negativeScore: number;
  matchType: 'accepted' | 'rejected' | null;
}

export interface MatchResult {
  score: number;
  predictedLetter: string;
  targetScore: number;
}

export interface Profile {
  id: string;
  name: string;
  created_at: string;
}

export interface Calibration {
  id: string;
  profile_id: string;
  letter: string;
  pattern_data: CalibrationData;
  proficiency?: number; // Phase 5: 0=UNKNOWN, 1=SOMETIMES, 2=KNOWN, 3=MASTERED
  created_at: string;
  updated_at: string;
}

// ========== PHASE 5: ADAPTIVE LEARNING TYPES ==========

export enum LetterProficiency {
  UNKNOWN = 0,      // Never learned or forgot
  SOMETIMES = 1,    // Getting it ~50% in current session
  KNOWN = 2,        // Mastered in current session (10+ correct without LISTEN)
  MASTERED = 3      // Long-term memory (correct from first attempts in next session)
}

export interface LetterStats {
  attempts: boolean[];                   // History of attempts (true = success)
  listen_clicks: number;                 // Times LISTEN was clicked
  first_attempts_result: boolean[];      // First 3 attempts (for MASTERED graduation test)
  consecutive_success_no_listen: number; // Streak for KNOWN graduation
  rapid_reps_remaining: number;          // Reps left after LISTEN click (3 total)
  state: 'normal' | 'graduated_to_known';
}

export interface SessionData {
  sessionId: string;
  profileId: string;
  startTime: Date;
  lastActivityTime: Date;
  attempts: Array<{
    letter: string;
    success: boolean;
    clickedListen: boolean;
    timestamp: Date;
  }>;
  letterStats: Map<string, LetterStats>; // Per-letter statistics
  newLettersIntroduced: string[];        // Letters introduced this session
  unknownLettersIntroduced: string[];    // UNKNOWN letters introduced (max 3)
  lettersGraduated: string[];            // Letters that graduated to KNOWN
  recentHistory: string[];               // Last 3 letters shown (avoid repetition)
}

export interface SessionConfig {
  TIMEOUT_MINUTES: number;
  GRADUATION_THRESHOLD: number;           // Correct without LISTEN to graduate to KNOWN
  MAX_NEW_LETTERS_PER_SESSION: number;
  GRADUATION_TEST_ATTEMPTS: number;       // First N attempts in next session
  GRADUATION_TEST_REQUIRED: number;       // How many of N must be correct
  MASTERED_DEMOTION_LISTEN_CLICKS: number;
  KNOWN_DEMOTION_LISTEN_CLICKS: number;
  RAPID_REP_COUNT: number;                // Reps after LISTEN click
  WARMUP_COUNT: number;                   // First N letters are warmup
  MIX_RATIO_PRACTICING: number;           // 50% practicing letters
}
