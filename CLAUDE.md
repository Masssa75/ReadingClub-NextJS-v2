# ReadingClub

**Version:** 1.6.0
**Last Updated:** November 10, 2025
**Status:** 🚀 LIVE at phuketcamp.com/phonics - Audio optimized, production ready

## 📁 Project Structure Overview

```
ReadingClub/
├── index-1.4.html                  # CURRENT: Optimized audio + auth (Session 6)
├── serve.js                        # Local HTTP server for CORS-free testing
├── test-auth-flow.js               # Playwright test for profile persistence
├── test-profile-switching.js       # Playwright test for profile switching
├── PHONICS-SYSTEM-README.md       # Technical documentation
├── CLAUDE.md                       # Project instructions (this file)
├── SUPABASE-SETUP.md              # Supabase configuration guide
├── stable-versions/                # Archived stable versions
├── supabase/                       # Supabase migrations
│   └── migrations/                 # Database migrations
└── logs/                           # Session logs
    ├── SESSION-LOG-INDEX.md       # Master session index (6 sessions total)
    ├── SESSION-LOG-2025-11-09.md  # Sessions 1-2 logs
    └── SESSION-LOG-2025-11-10.md  # Sessions 3-6 logs

Production:
└── BambooValley/phuket-camps/
    └── public/phonics/
        └── index.html              # DEPLOYED: https://phuketcamp.com/phonics
```

**Current State:** Single HTML file MVP deployed to production, Supabase backend, optimized audio

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

### The Golden Rule - ALWAYS Follow This Pattern:
```bash
1. Make code changes
2. git add -A && git commit -m "feat: description" && git push origin main
3. IMMEDIATELY (within 5 seconds) start streaming logs:
   netlify logs:deploy
   # Watch until you see "Build script success" or an error
4. If build fails:
   - Analyze the error from the logs
   - Fix the issue immediately
   - Repeat from step 1
5. If build succeeds, verify deployment:
   netlify api listSiteDeploys --data '{"site_id": "xxx"}' | jq '.[0].state'
   # Must show "ready"
6. npx playwright test --headed  # Test on DEPLOYED site (use --headless by default)
7. If tests fail:
   - Debug what's wrong
   - Fix and repeat from step 1
```

**NEVER**:
- Wait to push code "until it's ready"
- Test only locally
- Skip deployment verification
- Leave broken code undeployed

### Real-time Build Monitoring
```bash
# Stream deployment logs in real-time
netlify logs:deploy

# Get deployment details
netlify api listSiteDeploys --data '{"site_id": "xxx"}' | jq '.[0:3]'

# Get specific deployment error
netlify api getSiteDeploy --data '{"site_id": "xxx", "deploy_id": "DEPLOY_ID"}' | jq '.error_message'
```

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
- `logs/SESSION-LOG-INDEX.md` - Overview of all sessions (6 sessions total)
- `logs/SESSION-LOG-2025-11-09.md` - Sessions 1-2 detailed logs
- `logs/SESSION-LOG-2025-11-10.md` - Sessions 3-6 detailed logs

**Recent Sessions:**
- **Session 4:** Supabase integration + UI improvements for non-readers
- **Session 5:** Authentication + multi-profile support with Supabase
- **Session 6:** Audio optimization (24x smaller files) + production deployment to phuketcamp.com/phonics

## Current Status & Active Files

### Main Application
**File:** `index-1.4.html` (~3600 lines, single HTML file)
**Deployed:** https://phuketcamp.com/phonics
**Stable:** `index-1.2.html` (~2700 lines, moved to stable-versions folder)
**Technology:** Vanilla JavaScript + Web Audio API + Supabase + Supabase Auth

**Latest Features (Session 6):**
- ✅ **Optimized Audio** - 5-10KB files (24x smaller), 12x faster uploads (247ms vs 2700ms)
- ✅ **Individual Clip Recording** - Records per snapshot, saves only best from cluster
- ✅ **Post-Peak Extension** - Continues 700ms after peak for complete sound capture
- ✅ **Profile Switching Fixed** - Uses `.limit(1)` with ordering to load correct profile
- ✅ **Immediate Playback** - Audio works right after calibration without refresh
- ✅ **Simplified Auth UI** - "Save Progress" button instead of auto-popup
- ✅ **Production Deployment** - Live at phuketcamp.com/phonics via Netlify
- ✅ **Magic Link Redirect** - Correctly redirects to /phonics subdirectory

**Core Features (Session 1):**
- ✅ **26 letters** - Full alphabet in phonics sounds (A-Z)
- ✅ **Multi-user profiles** - Each person calibrates their own voice
- ✅ **Audio recording** - Records calibration for playback reference
- ✅ **4 tabs:**
  - Calibrate: Pausable voice pattern recording (snapshot → pause → continue)
  - Level 1: Listen & learn mode
  - Tuner: Flashcard practice with LISTEN button and mastery tracking
  - Game: Falling letters game (3 lives, increasing speed)
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

### Documentation
**File:** `PHONICS-SYSTEM-README.md`
- Complete technical documentation
- Algorithm explanations
- Evolution history (10+ approaches tried)
- Troubleshooting guide

### Next Development Phase
See [Session 6 Log](logs/SESSION-LOG-2025-11-10.md#session-6---audio-optimization--production-deployment) for details:

**High Priority:**
1. **Test with Ophelia** - Validate all features with real user (CRITICAL)
2. **Test Profile Switching** - Verify Ophelia/Rey/Marc profiles work in production
3. **Test Magic Link Auth** - Complete end-to-end auth flow verification
4. **Email Template Branding** - Customize magic link email for ReadingClub (deferred)

**Medium Priority:**
5. **Upload Audio in Background** - Don't block modal close while uploading
6. **Cross-Device Testing** - Verify calibrations sync across browsers
7. **Monitor Production** - Watch for errors, performance issues, user feedback

**Future:**
8. **Google OAuth Setup** - Complete Google Cloud Console configuration
9. **Spam Protection** (if needed):
   - RLS policies: Max 26 calibrations per profile, file size limits
   - Auto-delete anonymous profiles inactive for 7+ days
10. **Letter combinations** - sh, ch, th, etc.
11. **3-letter words** - cat, dog, etc.
12. **Onboarding flow** - Guide new users through calibration
13. **Stripe integration** - $1-5/month subscription

