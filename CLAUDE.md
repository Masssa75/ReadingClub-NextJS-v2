# ReadingClub

**Version:** 1.24.0
**Last Updated:** November 21, 2025
**Status:** ✅ Production Deployed at https://wunderkind.world

## 📁 Project Structure Overview

```
ReadingClub/
├── app/                            # PRIMARY: Next.js production app (DEPLOYED)
│   ├── MIGRATION-PLAN.md          # Migration history and phases
│   ├── README.md                  # Next.js app documentation
│   ├── package.json               # Next.js 16 + React 19 + TypeScript + Tailwind v3
│   ├── tailwind.config.ts         # Tailwind CSS v3 config (CRITICAL: v4 breaks Netlify)
│   ├── app/                       # Next.js App Router
│   ├── components/                # React components (CalibrationModal, etc.)
│   ├── lib/                       # Hooks, types, constants, Supabase
│   └── utils/                     # Audio engine, pattern matching, recording
├── index-1.4.html                  # LEGACY: Archived HTML version (stable-versions/)
├── serve.cjs                       # Local HTTP server for CORS-free testing
├── PHONICS-SYSTEM-README.md       # Technical documentation
├── CLAUDE.md                       # Project instructions (this file)
├── SUPABASE-SETUP.md              # Supabase configuration guide
├── stable-versions/                # Archived stable versions
├── supabase/                       # Supabase migrations
│   └── migrations/                 # Database migrations
└── logs/                           # Session logs
    ├── SESSION-LOG-INDEX.md       # Master session index (36+ sessions)
    └── SESSION-LOG-2025-11-*.md   # Daily session logs

Production Deployment:
└── GitHub: Masssa75/ReadingClub-NextJS-v2
    └── Netlify: learn2-parent-sharing → https://wunderkind.world
```

**Current State:** Next.js production app deployed at wunderkind.world. Full voice-based phonics learning with calibration, adaptive play mode, pattern visualization, and Supabase backend.

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

**IMPORTANT:** This project deploys to https://wunderkind.world via GitHub + Netlify auto-deploy.

**Production Site:**
- **URL:** https://wunderkind.world
- **GitHub Repo:** https://github.com/Masssa75/ReadingClub-NextJS-v2
- **Netlify Site:** learn2-parent-sharing (Site ID: 0d9c7411-304b-40d3-94bf-73d979c8bf33)

#### Step 1: Work in the app folder
```bash
cd /Users/marcschwyn/Desktop/projects/DRC/app
# Make your changes to Next.js app files
# Test locally: npm run dev (port 3001)
# Build locally: npm run build (verify no errors)
```

#### Step 2: Deploy to production
```bash
# Navigate to deployment repo
cd /Users/marcschwyn/Desktop/projects/ReadingClub-NextJS-v2-deploy

# Copy latest changes from DRC/app to deployment repo
# (Or work directly in deployment repo)

# Commit and push to GitHub
git add -A
git commit -m "feat: description of changes

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"
git push origin main
```

#### Step 3: Verify deployment
```bash
# Netlify auto-deploys from GitHub (takes 1-2 minutes)
# Monitor: netlify watch
# Or check: https://wunderkind.world
```

**CRITICAL TECH REQUIREMENTS:**
- ✅ **Tailwind CSS v3** (NOT v4 - v4 breaks Netlify builds)
- ✅ **Next.js 16** + React 19 + TypeScript
- ✅ Environment variables set in Netlify:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**NEVER**:
- Use Tailwind CSS v4 (causes CSS not to load in production)
- Wait to push code "until it's ready"
- Test only locally
- Skip deployment verification

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

## Voice Generator Tool

**Purpose:** Generate AI voice audio files for phonics instructions using OpenAI TTS.

**How to Start:**
```bash
# Kill any existing server on port 3333
lsof -ti:3333 | xargs kill -9 2>/dev/null

# Start the voice generator server
node voice-generator-server.js
# Server runs on port 3333 in background
```

**Access:** Open http://localhost:3333/voice-generator.html in browser

**Features:**
- Generate MP3 files using OpenAI TTS API (tts-1-hd model)
- Multiple voices available (nova, alloy, echo, fable, onyx, shimmer)
- Adjustable speed (0.25x to 4.0x)
- Folder organization support
- Saves to `voice-instructions/` directory
- Stores metadata (text, voice, speed) in `voice-instructions/metadata.json`
- Play/preview generated files
- Rename and favorite files

**Common Use Cases:**
- Generate phonics letter sounds (A → "ah", B → "buh")
- Create game instructions ("Click the letter you hear")
- Build celebration audio ("Great job! You got it!")
- Test different phonetic spellings for AI pronunciation

**API Access (for scripts):**
```bash
# Generate a voice file
curl -X POST http://localhost:3333/generate-voice \
  -H "Content-Type: application/json" \
  -d '{
    "text": "buh",
    "filename": "letter-b",
    "voice": "nova",
    "speed": 1.0,
    "folder": ""
  }'

# List existing files
curl http://localhost:3333/list-voices?folder=
```

**Requirements:**
- OpenAI API key in `.env` file (`OPENAI_API_KEY`)
- Node.js with Express and OpenAI package installed


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
- `logs/SESSION-LOG-INDEX.md` - Overview of all sessions (36 sessions total)
- `logs/SESSION-LOG-2025-11-09.md` - Sessions 1-2 detailed logs
- `logs/SESSION-LOG-2025-11-10.md` - Sessions 3-8 detailed logs
- `logs/SESSION-LOG-2025-11-11.md` - Sessions 9-13 detailed logs
- `logs/SESSION-LOG-2025-11-12.md` - Sessions 14-21 detailed logs
- `logs/SESSION-LOG-2025-11-14.md` - Sessions 22-25 detailed logs
- `logs/SESSION-LOG-2025-11-18.md` - Sessions 26-28 detailed logs
- `logs/SESSION-LOG-2025-11-19.md` - Session 29 detailed logs
- `logs/SESSION-LOG-2025-11-20.md` - Sessions 30-34 detailed logs
- `logs/SESSION-LOG-2025-11-21.md` - Sessions 35-36 detailed logs

**Recent Sessions:**
- **Session 34:** Next.js migration Phase 3 & 6 complete - Built PatternVisualization, snapshotScoring, negativeSnapshot components. Full Play tab (435 lines) with voice detection, adaptive learning, celebrations. Fixed 6 critical bugs (AudioContext, thresholds, closure bugs, case sensitivity). User testing verified working. See [Session 34 log](logs/SESSION-LOG-2025-11-20.md#session-34---november-20-2025).
- **Session 35:** Next.js app bug fixes - Fixed audio meters/visualization persistence, pattern matching case sensitivity, 5 TypeScript errors, added complete snapshot display grid. Created autonomous error detection system (Playwright + npm build). Achieved full feature parity with HTML version - zero runtime errors, zero TypeScript errors. See [Session 35 log](logs/SESSION-LOG-2025-11-21.md#session-35---november-21-2025).
- **Session 36:** Production deployment to wunderkind.world - Deployed Next.js app via Netlify, fixed critical Tailwind CSS v4→v3 styling issue (v4 incompatible with Netlify builds), created Playwright verification test, updated CLAUDE.md to mark app/ as PRIMARY and HTML as LEGACY. Verified full styling with automated testing. See [Session 36 log](logs/SESSION-LOG-2025-11-21.md#session-36---november-21-2025).

## Current Status & Active Files

### Production Application (PRIMARY)
**Location:** `/app` folder
**Deployed:** https://wunderkind.world
**Technology:** Next.js 16 + React 19 + TypeScript + Tailwind CSS v3
**Status:** ✅ Production-ready with full feature parity

**Core Features:**
- ✅ **26 letters** - Full alphabet phonics training (A-Z)
- ✅ **Multi-user profiles** - Profile selector with voice calibration per user
- ✅ **Voice calibration** - 5-snapshot capture system per letter with peak detection
- ✅ **2 main tabs:**
  - **Calibrate:** Pattern-based voice recording with pedagogical letter grouping (Vowels, Easy/Common/Advanced Consonants)
  - **Play:** Real-time voice recognition game with adaptive learning
- ✅ **Pattern visualization** - Live comparison of current voice vs stored calibration + complete snapshot grid
- ✅ **Adaptive learning** - Session management, proficiency tracking, success celebrations
- ✅ **Snapshot scoring** - Positive/negative training patterns for improved accuracy

**Technical Architecture:**
- **Algorithm:** Peak frequency spectrum matching with cluster-based outlier removal
- **Storage:** Supabase (calibration data + audio files) + localStorage (session state)
- **Audio Engine:** FFT analysis (2048 bins) → 64-bin downsampling → L1 distance matching
- **Recording:** 400ms pre-delay + peak detection + 700ms post-peak capture
- **Detection:** <100ms latency from peak to match, 60fps continuous analysis
- **Negative Snapshots:** Cross-letter rejection (stores mismatches to prevent false positives)
- **Performance:** Optimized WebM audio (5-10KB per letter), fast DB writes (525ms total)

**Key Components:**
- `app/calibrate/page.tsx` - Calibration interface with letter grid
- `app/play/page.tsx` - Voice recognition gameplay (435 lines)
- `app/components/CalibrationModal.tsx` - 5-snapshot capture UI
- `app/components/PatternVisualization.tsx` - Debug visualization
- `app/utils/audioEngine.ts` - Web Audio API wrapper
- `app/utils/fftAnalysis.ts` - Frequency analysis (CRITICAL: 2048 bins, 0.5 threshold)
- `app/utils/patternMatching.ts` - L1 distance comparison
- `app/utils/snapshotScoring.ts` - Positive/negative pattern scoring

**Recent Deployment (Session 36):**
- Deployed Next.js app to wunderkind.world via Netlify
- Fixed Tailwind CSS v4 → v3 downgrade (v4 incompatible with Netlify)
- Verified with Playwright: full styling, gradient background, proper component rendering
- See [Session 36 log](logs/SESSION-LOG-2025-11-21.md) for deployment details

### Next Development Priorities

**High Priority:**
1. **Cross-Device Testing** - Verify app works on tablets/phones (touch events, audio permissions)
2. **User Testing Feedback** - Implement improvements based on real child usage
3. **Performance Monitoring** - Track calibration success rates, false positives/negatives

**Medium Priority:**
4. **Enhanced Celebrations** - More visual feedback for successful letter recognition
5. **Progress Dashboard** - Show parent/teacher view of student progress over time
6. **Calibration Improvements** - Volume meter, minimum volume check, multi-calibration support

**Future Features:**
7. **Letter Combinations** - Digraphs (sh, ch, th, etc.)
8. **Simple Words** - 3-letter CVC words (cat, dog, etc.)
9. **Onboarding Flow** - Guided tutorial for first-time users
10. **Stripe Integration** - $1-5/month subscription model
11. **Spam Protection** - RLS policies (max 26 calibrations per profile, file size limits, auto-delete inactive profiles)

### Documentation
**File:** `PHONICS-SYSTEM-README.md` - Complete technical documentation with algorithm evolution history

### Legacy HTML Version (Archived)
**File:** `index-1.4.html` (~4500 lines, single HTML file)
**Previous URL:** https://phuketcamp.com/phonics
**Status:** Archived in `stable-versions/` folder
**Technology:** Vanilla JavaScript + Web Audio API + Supabase

This version was the MVP prototype and has been superseded by the Next.js production app. All features have been migrated with full parity. See session logs 1-35 for development history.

