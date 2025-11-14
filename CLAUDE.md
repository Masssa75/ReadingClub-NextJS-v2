# ReadingClub

**Version:** 1.12.0
**Last Updated:** November 14, 2025
**Status:** ✅ Stable - Critical bug fixes deployed (406 errors + session expiry)

## 📁 Project Structure Overview

```
ReadingClub/
├── index-1.4.html                  # CURRENT: Linear lessons system + golden letters
├── app/                            # NEW: Next.js migration (Session 12)
│   ├── MIGRATION-PLAN.md          # Phases 1-3 complete (Foundation, Audio, Calibration)
│   ├── README.md                  # Next.js app documentation
│   ├── package.json               # Next.js 16 + React 19 + TypeScript
│   ├── app/                       # Next.js App Router
│   ├── components/                # React components (CalibrationModal)
│   ├── lib/                       # Hooks, types, constants, Supabase
│   └── utils/                     # Audio engine, pattern matching, recording
├── serve.cjs                       # Local HTTP server for CORS-free testing
├── test-auth-flow.js               # Playwright test for profile persistence
├── test-profile-switching.js       # Playwright test for profile switching
├── voice-instructions/             # Audio files for game instructions
│   └── Congratulation level 1.mp3 # Celebration audio
├── PHONICS-SYSTEM-README.md       # Technical documentation
├── CLAUDE.md                       # Project instructions (this file)
├── SUPABASE-SETUP.md              # Supabase configuration guide
├── stable-versions/                # Archived stable versions
├── supabase/                       # Supabase migrations
│   └── migrations/                 # Database migrations
└── logs/                           # Session logs
    ├── SESSION-LOG-INDEX.md       # Master session index (20 sessions total)
    ├── SESSION-LOG-2025-11-09.md  # Sessions 1-2 logs
    ├── SESSION-LOG-2025-11-10.md  # Sessions 3-8 logs
    ├── SESSION-LOG-2025-11-11.md  # Sessions 9-13 logs
    └── SESSION-LOG-2025-11-12.md  # Sessions 14-20 logs

Production:
└── BambooValley/phuket-camps/
    └── public/phonics/
        └── index.html              # DEPLOYED: https://phuketcamp.com/phonics
```

**Current State:** Single HTML file MVP deployed to production, Supabase backend, optimized audio, linear lessons system. Next.js migration in parallel development (Phases 1-3 complete).

## Project Vision & Goals

### Core Mission
Make learning to read effortless through voice-based phonics training. Children learn letter sounds through interactive practice with instant feedback, progressing from listening to independent recognition.

### Business Model
- **Pricing:** $1-5/month subscription
- **Target:** 1,000+ subscribers initially
- **Potential:** Viral growth with built-in sharing features (planned)

### Success Metrics
- **Immediate:** Ophelia reads by end of week
- **Short-term:** Finish phonics book 1 by end of month
- **Long-term:** Subscription-based sustainable income from educational tool

### Target Audience
- **Primary:** Parents with children ages 3-9 learning to read
- **Secondary:** Homeschooling families, ESL learners
- **Geography:** Initially English speakers, expandable to other languages

## Learning Philosophy

### Three-Level Progression System
Based on homeschooling best practices, students advance through mastery:

**Level 1 - Listen Mode:**
- Letters flash on screen with audio
- Student clicks/taps letter to hear sound
- Passive learning, building familiarity
- Multiple rounds before advancing

**Level 2 - Say Together:**
- System plays sound
- Student says it simultaneously with audio
- Guided practice with support
- Builds confidence before independence

**Level 3 - Say Independently:**
- Student produces sound without prompts
- Real-time voice recognition (current Tuner/Game mode)
- Full mastery demonstration

### Two Practice Modes

**Full Alphabet Mode:**
- Practice all 26 letters sequentially
- Comprehensive review

**Typing Club Mode (Adaptive):**
- Focus on 2 letters at a time with heavy repetition
- Mix in previously mastered letters
- When student misses a letter → focused practice on that letter only
- Ensures mastery before progression

## Autonomous Development Workflow

### Deployment Process - How to Push to Production

**IMPORTANT:** This project deploys to https://phuketcamp.com/phonics2/ via GitHub + Netlify auto-deploy.

#### Step 1: Make changes in DRC project
```bash
cd /Users/marcschwyn/Desktop/projects/DRC
# Make your changes to index-2.0.html
git add -A
git commit -m "feat: description"
# Note: No remote configured in DRC repo - commits are local only
```

#### Step 2: Copy to deployment repo and push
```bash
# Copy updated file to deployment location
cp /Users/marcschwyn/Desktop/projects/DRC/index-2.0.html \
   /Users/marcschwyn/Desktop/projects/BambooValley/phuket-camps/public/phonics2/index.html

# Navigate to deployment repo
cd /Users/marcschwyn/Desktop/projects/BambooValley/phuket-camps

# If git lock exists, remove it:
rm -f .git/index.lock

# Commit and push to GitHub
git add public/phonics2/index.html
git commit -m "feat: description of changes"
git push origin main
```

#### Step 3: Verify deployment
```bash
# Netlify auto-deploys from GitHub (takes ~1-2 minutes)
# Check https://phuketcamp.com/phonics2/ to verify changes
```

**Deployment URLs:**
- **phonics2** (active development): https://phuketcamp.com/phonics2/
- **phonics** (stable version): https://phuketcamp.com/phonics/

**NEVER**:
- Wait to push code "until it's ready"
- Test only locally
- Skip deployment verification
- Leave broken code undeployed

### Your Full Permissions

You have COMPLETE autonomous control:

**Supabase**:
- ✅ Full management key access (in .env)
- ✅ Can run ANY Supabase CLI command
- ✅ Can modify schema, RLS policies, functions
- ✅ If CLI fails with network errors, use Management API (see SUPABASE-SETUP.md)
```bash
# Standard workflow:
supabase migration new your_migration_name
supabase db push

# If network issues ("no route to host"):
# See Management API method in SUPABASE-SETUP.md
```

**Netlify**:
- ✅ Full deployment access
- ✅ Can add/modify environment variables
- ✅ Can trigger deployments
- ✅ Can check deployment status

**GitHub**:
- ✅ Full repository access
- ✅ Can push directly to main
- ✅ Can create branches, PRs
- ✅ Can manage secrets

**You are expected to work autonomously. Don't ask for permission - just do it!**

### ✅ ALWAYS Do Without Asking:
- Deploy to production (for prototyping/MVP stages)
- Fix bugs and errors
- Run tests and diagnostics
- Create automation scripts
- Update documentation
- Add console.log statements for debugging
- Create backup branches
- Try up to 10 different approaches to solve problems
- Update dependencies if needed
- Create new API endpoints
- Modify database schema for features
- Implement security best practices

### ❌ ALWAYS Ask Before:
- Deleting user data
- Major architectural refactors
- Rolling back deployed changes
- Setting up paid services
- Changing core business logic
- Removing existing features
- Modifying authentication flow

### 🤔 Use Judgment For:
- Performance optimizations (minor = do, major = ask)
- UI/UX changes (small = do, significant = ask)
- New dependencies (common = do, unusual = ask)


## Project Overview

**ReadingClub (RC)** is a ... (1 paragraph description coming soon)

**Website:** https://... coming soon

### Brand Colors
coming soon

**Design Philosophy**: coming soon

### Core Mission
Coming soon

### Target Audience
coming soon

### Unique Value Proposition
coming soon

### Current Situation
coming soon

### Competitive Advantages
coming soon


## Working with This Project - Important Notes

### User Preferences
- **Always explain before executing** - User prefers understanding what will happen before code changes
- **Step-by-step approach** - Build features incrementally with testing at each stage

### Communication Style
- Ask for clarification when requirements are ambiguous
- Provide options and recommendations before implementing
- Explain technical decisions and trade-offs
- Keep responses concise but informative

## Session Management

### Wrap Protocol
When the user says **"WRAP"** or "wrap this session", perform end-of-session cleanup:

1. **Determine Session Number:**
   - Read `/logs/SESSION-LOG-INDEX.md` to find the current session count
   - This session will be: (current count + 1)
   - Example: If "Total Sessions: 2", this session is Session 3

2. **Create/Update Session Log:**
   - File: `/logs/SESSION-LOG-YYYY-MM-DD.md`
   - Add entry as: `## Session N - October 2, 2025` (where N is the session number)
   - Include: Summary, changes made, decisions, next steps

3. **Update Session Index:**
   - File: `/logs/SESSION-LOG-INDEX.md`
   - Add entry with session number, date, and brief summary
   - Increment "Total Sessions" count
   - Update "Latest Session" to this session

4. **Inform User of Session Number:**
   - After wrapping, tell the user: "Session N wrapped successfully" (where N is the session number)
   - This helps the user track which session they just completed

5. **Update CLAUDE.md:**
   - Move detailed work to session logs
   - Keep only essential current state info
   - Replace moved sections with 1-line summary + link

6. **Mark Todos as Complete:**
   - Update todo statuses for completed work
   - Delete completed todos after moving to logs

7. **Update Version & Date:**
   - Increment version number
   - Update "Last Updated" timestamp

### Mid-Task WRAP
If wrapping during incomplete work:
- Keep incomplete todos as "pending" or "in_progress"
- Add "Next Session Notes" section to CLAUDE.md
- Document: current progress, next steps, important context
- List files partially modified and tests still needed

### Session Logging Guidelines
- Keep CLAUDE.md focused on current state and essential documentation
- Move completed work details to dated session logs
- Each moved section = 1-line summary + link in CLAUDE.md
- Session logs preserve full history while keeping main doc clean

## Development Workflow

### Task Management
- Use TodoWrite tool frequently to track progress and plan complex tasks
- Mark todos complete immediately after finishing each task
- Break down large tasks into smaller, trackable steps

### Code Conventions
- Mimic existing code style and patterns in the codebase
- Check package.json before using any libraries - never assume availability
- Look at existing components for naming conventions and structure
- Include `file_path:line_number` when referencing code
- Never add comments unless explicitly requested
- Never commit unless explicitly asked

### Testing & Verification
- Run lint and typecheck commands when available
- Check README or codebase for testing approach
- Use Task tool for file searches to reduce context usage
- Run multiple bash commands in parallel when possible


## Communication Style
- Ask for clarification when requirements are ambiguous
- Provide options and recommendations before implementing
- Explain technical decisions and trade-offs
- Keep responses concise but informative

## Development Rules

### Critical Rules (NEVER BREAK THESE):
1. **Never create fallback systems** without explicit request
2. **Always create backup** before major changes
3. **Do only what's asked** - nothing more, nothing less
4. **Never create files** unless absolutely necessary
5. **Always prefer editing** existing files to creating new ones
6. **API keys go in .env file** - never in code or CLAUDE.md
7. **Never proactively create documentation files** unless requested


## The Sunbeam Debugging Protocol (from Monitoor project)
When debugging issues, follow this systematic 5-step approach:

### Step 1: Browser Testing (Always First!)
- Manually reproduce the issue in browser
- Note exact steps to reproduce
- Take screenshots/record console errors
- Never claim something works without verification

### Step 2: Investigate Root Cause
- Trace data flow through components
- Check API responses
- Verify state management
- Identify exact failure point

### Step 3: Implement Minimal Fix
- Fix only what's broken
- Avoid refactoring unless necessary
- Test fix immediately
- Document any assumptions

### Step 4: Verify with Automation
- Create browser automation test
- Verify fix works consistently
- Test edge cases
- Ensure no regressions

### Step 5: Document Everything
- Update CLAUDE.md immediately
- Note what was broken and why
- Document the fix approach
- Update test documentation

---

## Session Logs

**All session accomplishments are documented in the `logs/` folder.**

See:
- `logs/SESSION-LOG-INDEX.md` - Overview of all sessions (23 sessions total)
- `logs/SESSION-LOG-2025-11-09.md` - Sessions 1-2 detailed logs
- `logs/SESSION-LOG-2025-11-10.md` - Sessions 3-8 detailed logs
- `logs/SESSION-LOG-2025-11-11.md` - Sessions 9-13 detailed logs
- `logs/SESSION-LOG-2025-11-12.md` - Sessions 14-21 detailed logs
- `logs/SESSION-LOG-2025-11-14.md` - Sessions 22-23 detailed logs

**Recent Sessions:**
- **Session 21:** Pattern comparison visualization added to Play tab + pitch recognition analysis (4 test approaches created). See [Session 21 log](logs/SESSION-LOG-2025-11-12.md#session-21---november-13-2025).
- **Session 22:** Pattern training system + proficiency migration (eliminated 406 errors, enabled long-term learning). See [Session 22 log](logs/SESSION-LOG-2025-11-14.md#session-22---november-14-2025).
- **Session 23:** Voice generator folder support + critical bug fixes (406 errors + letterStats.entries). See [Session 23 log](logs/SESSION-LOG-2025-11-14.md#session-23---november-14-2025).

## Current Status & Active Files

### Main Application
**File:** `index-1.4.html` (~4500 lines, single HTML file)
**Deployed:** https://phuketcamp.com/phonics
**Stable:** `index-1.2.html` (~2700 lines, moved to stable-versions folder)
**Technology:** Vanilla JavaScript + Web Audio API + Supabase + Supabase Auth

**Latest Features (Session 21):**
- ✅ **Pattern Comparison Visualization** - Side-by-side view of stored calibration vs current recording in Play tab
- ✅ **Real-time Pattern Display** - 64-bin frequency patterns shown as colored bars during voice detection
- ✅ **Debug Visualization** - Helps understand why matches succeed or fail, shows calibration quality

**Session 13 Features:**
- ✅ **Linear Lessons System** - TypingClub-style progression with 5 lessons (A listen, A solo, E listen, E solo, Mix A+E)
- ✅ **Visual Lesson States** - Completed (green ✅), Current (yellow glowing ▶), Locked (grey 🔒)
- ✅ **Golden Letters** - Completed calibrations display with golden gradient effect

**Session 11 Features:**
- ✅ **Pedagogical Letter Grouping** - Calibration grid organized by learning difficulty
- ✅ **Visual Group Headers** - "Vowels", "Easy Consonants", "Common Consonants", "Advanced"

**Session 10 Features:**
- ✅ **Voice Instruction Popup** - Auto-plays "game play 1_v2.mp3" when starting game
- ✅ **Celebration Modal** - Confetti animation + "A success B start.mp3" for Level 1 completion
- ✅ **Audio MIME Type Fix** - `decodeURIComponent()` in serve.cjs for files with spaces

**Session 9 Features:**
- ✅ **Game 2 Level 1** - Complete beginner mode with auto-play audio + voice recognition
- ✅ **Success Counter** - ⭐ 0/10 tracker with completion celebration at 10 consecutive matches
- ✅ **Per-Letter Sensitivity** - Settings button in calibration cards with Easy/Normal/Strict slider

**Previous Features (Session 6):**
- ✅ **Optimized Audio** - 5-10KB files (24x smaller), 12x faster uploads (247ms vs 2700ms)
- ✅ **Production Deployment** - Live at phuketcamp.com/phonics via Netlify

**Core Features (Session 1):**
- ✅ **26 letters** - Full alphabet in phonics sounds (A-Z)
- ✅ **Multi-user profiles** - Each person calibrates their own voice
- ✅ **Audio recording** - Records calibration for playback reference
- ✅ **6 tabs:**
  - Calibrate: Pausable voice pattern recording (snapshot → pause → continue) with per-letter sensitivity
  - Level 1: Listen & learn mode (flashcards)
  - Tuner: Flashcard practice with LISTEN button and mastery tracking
  - Game: Falling letters game (3 lives, increasing speed)
  - Game 2: Level 1 beginner mode (auto-play audio, voice recognition, success counter)
  - 📚 Lessons: Linear progression system (5 lessons with clear completion states)
- ✅ **Detection algorithm:** S11-Snapshot (80%+ accuracy)
- ✅ **Dynamic thresholds:** Adjusted per phoneme type

**Technical Details:**
- **Algorithm:** Peak frequency spectrum matching with cluster-based outlier removal
- **Storage:** Supabase (calibration data + audio files) + localStorage (attempt history, profile names)
- **Audio:** Individual 5-10KB WebM clips per letter (optimized from 120KB)
- **Recording:** 400ms pre-delay + peak detection + 700ms post-peak = complete sound
- **Detection:** FFT analysis (4096 bins) → 64-bin downsampling → L1 distance
- **Latency:** <100ms from peak to detection
- **Frame rate:** 60fps continuous analysis
- **Performance:** 247ms upload + 277ms DB save = 525ms total (5.7x faster than before)

### Next.js Migration (Session 12)
**Location:** `/app` folder (parallel development)
**Status:** ✅ Phases 1-3 complete (Foundation, Audio System, Calibration)
**Running:** Port 3001 (`npm run dev`)
**Plan:** See `app/MIGRATION-PLAN.md` for full roadmap

**What's Built:**
- ✅ Complete audio engine (audioEngine, frequencyAnalysis, patternMatching, audioRecording)
- ✅ Calibration modal with 5-snapshot capture and peak detection
- ✅ Supabase integration (profiles, calibrations, audio storage)
- ✅ Type-safe with TypeScript
- ✅ Next button auto-advances to next uncalibrated letter

**What's Next:**
- Phase 4: Profile Management UI (optional)
- Phase 5: Tuner component (required)
- Phase 6: Game 3 component (required)

**Details:** See [Session 12 log](logs/SESSION-LOG-2025-11-11.md#session-12---november-11-2025) for full migration details.

### Documentation
**File:** `PHONICS-SYSTEM-README.md`
- Complete technical documentation
- Algorithm explanations
- Evolution history (10+ approaches tried)
- Troubleshooting guide

### Next Development Phase
See [Session Log Index](logs/SESSION-LOG-INDEX.md) for all 20 sessions.

**🚨 Pending User Testing (Session 20):**

User is testing current system with daughter (quiet voice issue). Awaiting feedback to determine which solutions to implement:
1. **Minimum Volume Check** - Reject quiet calibrations during capture (15 mins)
2. **Visual Volume Meter** - Real-time feedback green/yellow/red (30 mins)
3. **Multi-Calibration Per Letter** - Handle day-to-day voice variation (2 hours)
4. **Pattern Sanity Validation** - Phoneme-specific checks (1 hour)

**🚨 CRITICAL - Next.js App Development:**

1. **Adaptive Learning System** - IN PROGRESS (Phases 6.1-6.4 complete, 20-25 hours total)
   - **Full Spec**: See `/app/ADAPTIVE-TUNER-SPEC.md` for complete implementation details
   - **Why**: User testing revealed kids interact more naturally with self-paced Tuner than structured lessons
   - **What**: Transform Tuner into adaptive system that tracks proficiency and adjusts letter selection
   - **Key Phases**:
     - Phase 6.1: Database + Proficiency Storage (add proficiency column to Supabase)
     - Phase 6.2: Session Management (localStorage for attempts, 30-min timeout)
     - Phase 6.3: Adaptive Algorithm (warmup → new letter → 5 reps → 50/50 mix → graduation)
     - Phase 6.4: Tuner Integration (track LISTEN clicks, replace random selection)
     - Phase 6.5: Progress Display (mastered/known/learning stats)
     - Phase 6.6: Celebrations (KNOWN and MASTERED graduations)
     - Phase 6.7: Testing & Tuning (with Ophelia and siblings)
   - **Key Insight**: Letter only reaches MASTERED if correct in NEXT session (spaced repetition)
   - **Location**: `/app` folder (Next.js migration, parallel to index-1.4.html)
   - **Migration Plan**: See `/app/MIGRATION-PLAN.md` Phase 6

**HTML Version (index-1.4.html) - Maintenance Only:**
- Keep stable for production at phuketcamp.com/phonics
- No major new features (focus on Next.js app)
- Bug fixes only if critical

**Medium Priority:**
2. **Cross-Device Testing** - Verify Next.js app works on tablets/phones
3. **Profile Management UI** - Add profile selector dropdown in Next.js app
4. **Visual Polish** - More celebration effects in adaptive system

**Future:**
5. **Letter combinations** - sh, ch, th, etc.
6. **3-letter words** - cat, dog, etc.
7. **Parent Dashboard** - Weekly progress reports, letter difficulty heatmap
8. **Onboarding flow** - Guide new users through calibration
9. **Stripe integration** - $1-5/month subscription
10. **Spam Protection** (if needed):
    - RLS policies: Max 26 calibrations per profile, file size limits
    - Auto-delete anonymous profiles inactive for 7+ days

