# Session Log - November 18, 2025

## Session 26 - November 18, 2025
**Focus:** Snapshot Score System Debugging & Multi-Profile Calibration Display
**Time Spent:** ~2 hours
**Status:** ✅ Complete - All snapshot scoring issues fixed and deployed to /phonics4

### Context
This session continued work from a crashed instance. User was testing the new snapshot-based calibration system and discovered several bugs in the visualization and scoring system.

### Key Achievements

#### 1. Nasal Volume Threshold Reduction (m, n)
- **Problem:** Letter 'm' was impossible to trigger during calibration
- **Root Cause:** Volume threshold too high (8) for quiet nasal consonants
- **Solution:** Reduced nasal volume threshold from 8 → 4 in all three locations:
  - Line 2854: Calibration recording
  - Line 3343: Manual recording modal
  - Line 6214: Game detection (also affects liquids l, r)
- **Files Modified:** `index-4.0.html`
- **Deployment:** Committed and deployed to `/phonics4`

#### 2. Stored Calibration Visualization Fix
- **Problem:** Bottom-left "Stored Calibration" section wasn't showing loaded patterns
- **Root Cause:** `visualizeStoredPattern()` looking for old format (`.patterns` or `.pattern`), but system now uses `.snapshots` with `.data` property
- **Solution:**
  - Updated to use `calibrationData[letter].snapshots` array
  - Extract `.data` from each snapshot object
  - Find first positive snapshot for visualization
  - Updated pattern count to correctly display positive vs negative snapshots
- **Result:** Now shows "5 positive, 2 negative" style count
- **Files Modified:** `index-4.0.html` (lines 4850-4874)
- **Deployment:** Committed (f3b2960) and deployed to `/phonics4`

#### 3. Snapshot Grid Display with Scores & Profile IDs
- **Problem:** System showed count of snapshots but not individual visualizations
- **Goal:** Display all snapshots from all profiles with their scores
- **Solution:**
  - Updated `visualizeAdditionalPatterns()` to load from Supabase (not just localStorage)
  - Display ALL snapshots from `calibrationData[letter].snapshots`
  - Modified `createPatternCard()` to accept `score` and `profileId` parameters
  - Added info display showing: `✓ X matches | Profile: abc12345`
  - Separated positive and negative snapshots with color coding (green/red borders)
- **What Score Means:** Success counter - increments each time snapshot successfully matches
- **Files Modified:** `index-4.0.html` (lines 4931-4977, 4982-5026)
- **Deployment:** Committed (def4354) and deployed to `/phonics4`

#### 4. Snapshot Sorting by Score
- **Problem:** Snapshots displayed in arbitrary order
- **Solution:** Sort both positive and negative snapshots by score (highest first)
- **Result:** Best-performing snapshots appear at top of grid
- **Files Modified:** `index-4.0.html` (lines 4961-4965)

#### 5. Automatic Migration of Old Calibrations
- **Problem:** Existing calibrations in old format couldn't track scores
- **Solution:** Created `migrateOldCalibrationsToNewFormat()` function that:
  - Detects old format calibrations (missing `.snapshots`)
  - Converts `{ pattern: [[...], [...]] }` → `{ snapshots: [{data, score, isNegative, profileId, createdAt}] }`
  - Handles very old format (pattern_data is just the array)
  - Saves back to Supabase with updated format
  - Runs automatically on page load, only once per calibration
- **Files Modified:** `index-4.0.html` (lines 2313-2388)
- **Deployment:** Committed (0538fbd) and deployed to `/phonics4`

#### 6. Snapshot Score Increment Bug Fix (CRITICAL)
- **Problem:** ALL snapshots showed "✓ 0 matches" even after successful detections
- **Investigation:**
  - Created `check-scores.cjs` to query database directly
  - Found all snapshots had `score = 0` in database
  - Console showed "calling incrementSnapshotScore" but scores weren't saving
  - Letter 'a' had 6 points (from Nov 17), but 'o' and 'p' had 0
- **Root Cause:** `incrementSnapshotScore()` used `indexOf()` which compares object references, not data content
  - The snapshot from `window.lastMatchInfo.positiveSnapshot` was a different object reference than snapshots in `calibrationData[letter].snapshots`
  - `indexOf()` returned -1, so score never incremented
- **Solution:**
  - Replaced `indexOf()` with `findIndex()` that matches by pattern data content
  - Compares first 10 frequency values to identify matching snapshot
  - Increments score on the actual object in `calibrationData` (not the search object)
  - Added comprehensive debug logging showing search process
- **Files Modified:** `index-4.0.html` (lines 2417-2449)
- **Deployment:** Committed (2f6ff85) and deployed to `/phonics4`
- **Verification:** User confirmed scores now incrementing correctly

#### 7. Real-Time Visualization Updates (Reverted)
- **Attempted:** Auto-refresh snapshot grid after each match to show updated scores
- **Concerns:**
  - Would recreate ALL canvas elements on every match (10-20 redraws per match)
  - Potential visual flickering and performance degradation
  - Distracting UI updates during active gameplay
- **Decision:** Reverted changes, kept existing behavior
- **Current Behavior:** Scores update in memory/database, display refreshes when switching letters
- **Result:** Cleaner, more performant UX

### Technical Details

#### Snapshot Data Structure
```javascript
{
  data: [64 frequency bins],
  score: 0,           // Increments on each successful match
  isNegative: false,  // true for "Not X" snapshots
  profileId: "abc123",
  createdAt: "2025-11-18T12:00:00Z"
}
```

#### Migration Logic
- Old format: `{ pattern: [[...], [...]] }` or `{ pattern_data: [...] }`
- New format: `{ snapshots: [{data, score, isNegative, profileId, createdAt}] }`
- Auto-detects and converts on page load
- Backward compatible (checks for `.snapshots` before migrating)

#### Scoring Timeline Discovery
- Nov 17, 11:58 PM: Letter 'a' had 6 successful matches recorded
- Nov 18, 12:00 AM: Scoring broke (likely during snapshot migration)
- Nov 18: Session 26 fixed the `indexOf()` bug
- Result: All letters can now accumulate scores from scratch

### Files Created
- `check-scores.cjs` - Database query tool for debugging snapshot scores

### Deployment
All changes deployed to:
- **Production URL:** https://phuketcamp.com/phonics4/
- **DRC Repo:** 6 commits (a6aa279, f3b2960, def4354, 913070d, 0538fbd, 2f6ff85)
- **Phuket-Camps Repo:** 6 corresponding commits
- **Auto-Deploy:** Netlify triggered successfully

### User Testing
- User confirmed snapshot visualization working
- User confirmed scores incrementing after fix
- User verified multi-profile calibrations displaying correctly

### Next Steps
- Monitor score accumulation during real gameplay
- Verify migration works for all users' old calibrations
- Consider adding score-based snapshot pruning (remove low-performing snapshots)
- Potential enhancement: Show which snapshot "won" during each match

### Key Learnings
1. **Object Reference vs Content:** Always use content-based matching for data structures loaded from database
2. **Debug Tools:** Creating `check-scores.cjs` was essential for isolating the database vs UI issue
3. **Performance Trade-offs:** Real-time updates look nice but can cause jank - batch updates on state change are better
4. **Migration Strategy:** Auto-migration on page load is transparent to users and backward compatible

---

## Session 27 - November 18, 2025
**Focus:** Cross-Profile Snapshot Pooling System & Manual Migration Tool
**Time Spent:** ~2.5 hours
**Status:** ✅ Complete - Cross-profile pooling implemented with manual migration button

### Context
User wanted to implement a crowd-sourced voice recognition system where calibrations from all profiles (Marc, Ofelia, Rey) are pooled together. When any user plays, they benefit from everyone's calibrations. Each snapshot gets scored over time to identify the most reliable patterns.

### Key Achievements

#### 1. Cross-Profile Snapshot Pooling System
- **What Changed:** System now loads calibrations from ALL profiles, not just current user
- **Implementation:**
  - Modified `loadCalibrationsFromSupabase()` to remove `.eq('profile_id', currentProfileId)` filter
  - Loads every calibration from every profile in the database
  - Merges all snapshots (positive & negative) into a single pool per letter
  - Each snapshot retains its `profileId` so we know who contributed it
- **Benefit:** New users benefit from existing calibrations immediately
- **Example:** If Marc, Ofelia, and Rey each calibrated 'A', there are now 3+ snapshots pooled for letter 'A'
- **Console Output:** `✅ Loaded 26 letters with 78 total snapshots from 3 profiles`

#### 2. Snapshot Scoring System
- **Positive Snapshots:** Get +1 point each time they successfully match
- **Negative Snapshots:** Get +1 point max per "round" when they prevent a false positive
- **Round Tracking:** When letter changes, negative snapshot awards reset
- **Persistence:** Scores auto-save to Supabase (debounced 2 seconds)
- **Implementation:**
  - Created `incrementSnapshotScore(letter, snapshot)` function
  - Created `debounceSaveScores(letter, profileId)` for batched saves
  - Created `saveSnapshotScoresToSupabase(letter, profileId)` async function
  - Created round tracking functions: `startNewScoringRound()`, `canAwardNegativePoint()`, `markNegativeSnapshotAwarded()`
  - Integrated score increment into match detection (line 4132) and rejection logic (line 4550-4557)
  - Call `startNewScoringRound()` when target letter changes (line 3847)

#### 3. New Snapshot Data Structure
**Before (localStorage only):**
```javascript
calibrations[letter] = {
  patterns: [[...], [...]],        // Supabase
  negativePatterns: [[...], [...]],// localStorage only
  audioUrl: "..."
}
```

**After (unified in Supabase):**
```javascript
{
  snapshots: [
    {
      data: [0.1, 0.2, ...],      // 64-bin frequency pattern
      score: 0,                    // Success counter
      isNegative: false,           // true for "Not X" patterns
      profileId: "uuid-string",    // Who created it
      createdAt: "2025-11-18..."   // Timestamp
    }
  ]
}
```

#### 4. Backward Compatibility
- **Old Supabase Format:** `{ pattern: [[...], [...]] }` → Auto-converts to snapshot format
- **Very Old Format:** `pattern_data` is just array → Auto-converts to snapshot format
- **localStorage Extras:** Loads positive/negative patterns from localStorage and converts to snapshots
- **Zero Data Loss:** All existing calibrations work seamlessly
- **Implementation:** Lines 2232-2302 in `loadCalibrationsFromSupabase()`

#### 5. Manual Migration Button
- **Location:** Calibrate tab → "🔄 Migrate Old Data" button (orange)
- **What It Does:**
  - Scans all profiles in Supabase
  - Checks localStorage for `calibration_extras_*` keys
  - Converts old positive/negative patterns to new snapshot format
  - Merges with existing Supabase calibrations (non-destructive)
  - Saves everything to Supabase
  - Shows live progress and results
- **UI Feedback:**
  - "📊 Found 3 profile(s)"
  - "🔄 Migrating profile: Marc..."
  - "✓ Marc/A: 3 snapshot(s)"
  - "✅ Migration Complete! Migrated 45 snapshot(s) across 18 letter(s)"
- **Safety:** Non-destructive, can run multiple times without duplicates
- **Implementation:** Lines 2420-2582 (`migrateLocalStorageToSupabase()` function)

#### 6. Updated Training Buttons (Add Positive/Negative Patterns)
- **Before:** Added to `patterns` and `negativePatterns` arrays, saved to localStorage
- **After:** Creates snapshot objects with full metadata, saves to Supabase
- **Implementation:**
  - `addPositivePattern()`: Lines 3431-3467
  - `addNegativePattern()`: Lines 3469-3507
  - Both now call `debounceSaveScores()` instead of `saveCalibrationExtras()`

#### 7. Updated Matching Algorithm
- **Strategy11 Snapshot Matching:** Updated to work with new snapshot structure
- **Before:** Separate loops for `patterns` and `negativePatterns`
- **After:** Single loop through `snapshots` array, separated by `isNegative` flag
- **Match Info:** Stores winning positive AND negative snapshot for scoring
- **Implementation:** Lines 4390-4570

### Technical Details

#### Performance Estimate
- **50-100 snapshots/letter:** No impact (~1,300-2,600 total)
- **100-300 snapshots/letter:** Slight impact (~2,600-7,800 total)
- **300+ snapshots/letter:** May need optimization (Web Workers, top-N filtering)
- **Current:** With smart pruning via scoring, expect ~10-50 snapshots/letter naturally

#### Scoring Logic
**Positive Snapshots:**
- Only best-matching snapshot gets +1 point per attempt
- Encourages high-quality calibrations

**Negative Snapshots:**
- Max 1 point per round (letter display)
- Only gets point if it prevented a match that would have scored >80%
- Prevents spam from multiple rejections of same sound

#### Data Migration Path
1. **Page Load:** Auto-converts old format to new (in-memory only)
2. **User Clicks "Migrate Old Data":** Converts localStorage extras → Supabase
3. **New Calibrations:** Created in new format directly
4. **Training Patterns:** Added in new format to Supabase

### Files Modified
- `index-4.0.html` (primary implementation file)
  - Modified: `saveCalibrationToSupabase()` - saves new snapshot format
  - Modified: `loadCalibrationsFromSupabase()` - loads from ALL profiles with backward compatibility
  - Modified: `strategy11_simpleSnapshot()` - works with new snapshot structure
  - Added: Snapshot scoring system functions (8 functions)
  - Added: `migrateLocalStorageToSupabase()` function
  - Modified: `addPositivePattern()` and `addNegativePattern()`
  - Modified: `setNextTarget()` - starts new scoring round
  - Modified: Match detection logic - increments scores
- `CLAUDE.md` - Added negative snapshot explanation to Technical Details

### Deployment
All changes deployed to:
- **Production URL:** https://phuketcamp.com/phonics4/
- **DRC Repo:** 2 commits (8478aa8, b8e07ec)
- **Phuket-Camps Repo:** 2 corresponding commits
- **Auto-Deploy:** Netlify triggered successfully

### User Questions & Answers

**Q: What have you added to the database?**
- A: No schema changes! Only the JSON structure inside `pattern_data` (JSONB column) changed

**Q: How did negative snapshots work previously?**
- A: They were stored in localStorage only, never synced to database or across devices

**Q: Do I need to recalibrate from scratch?**
- A: No! Old data loads automatically. Use migration button to permanently move localStorage → Supabase

### Next Steps
1. **Test with multiple profiles** - Create calibrations for Marc, Ofelia, Rey
2. **Monitor score accumulation** - See which snapshots perform best
3. **Consider score-based pruning** - Remove snapshots with consistently low scores
4. **Cross-device testing** - Verify snapshots sync properly
5. **Performance monitoring** - Track if many snapshots cause slowdown

### Key Learnings
1. **JSONB Flexibility:** No schema changes needed - just store different JSON structure
2. **Cross-Profile Benefits:** Crowd-sourced calibrations help everyone, especially new users
3. **Scoring Reveals Quality:** Over time, best snapshots naturally rise to top
4. **Migration UX:** Clear progress feedback makes users confident in data migration
5. **Backward Compatibility:** Critical for smooth transitions - no user disruption

---

## Session 28 - November 18, 2025
**Focus:** Snapshot Score Persistence Debugging & Critical Bug Fixes
**Time Spent:** ~3 hours
**Status:** ✅ Complete - All scoring bugs fixed, scores now persist correctly

### Context
User reported that snapshot scores were incrementing in memory (visible in console logs) but not persisting to the database. Investigation revealed multiple layered bugs preventing scores from being saved.

### Key Achievements

#### 1. Fixed Score Flushing System
- **Problem:** Scores were incremented in memory but debounced saves (2 seconds) never fired
- **Root Cause:** Letter changes, page navigation, or continuous play prevented debounce timer from completing
- **Solution:** Added immediate score flushing on critical events:
  - Letter change (`startNewScoringRound`)
  - Tab switching (`switchTab`)
  - Page unload (`beforeunload` event)
- **Implementation:** Created `flushAllPendingScores()` and `pendingSaves` tracking Set
- **Files Modified:** `index-4.0.html` (lines 2451-2531)

#### 2. Fixed Case Sensitivity Bug
- **Problem:** Database stores letters as uppercase ('K') but code saved with lowercase ('k')
- **Root Cause:** `.eq('letter', 'k')` doesn't match 'K' in PostgreSQL (case-sensitive)
- **Solution:** Changed `.eq()` to `.ilike()` for case-insensitive matching
- **Impact:** Scores were "saving" but UPDATE query found 0 rows to update
- **Files Modified:** `index-4.0.html` (line 2555)
- **Commit:** 4699667

#### 3. Fixed Wrong Letter Scoring Bug
- **Problem:** Matching letter 's' incremented score for letter 'j'
- **Root Cause:** `window.lastMatchInfo.target` was from previous letter (stale data)
- **Investigation:** Added detailed logging showing `targetsMatch: false`
- **Solution:** Added validation check `lastMatchInfo.target === currentTarget`
- **Files Modified:** `index-4.0.html` (lines 4494-4519)
- **Commit:** 23d07f7

#### 4. Fixed Stale lastMatchInfo Bug (CRITICAL)
- **Problem:** `lastMatchInfo` always stale because strategy loops through ALL letters
- **Root Cause:** `testAllPlosiveStrategies()` calls strategy for a,b,c...z, overwriting `lastMatchInfo` 26 times
- **Discovery:** Strategy loop at lines 4735-4744 tests against all calibrated letters
- **Solution:** After detecting success, call `strategy11_simpleSnapshot(patternBuffer, currentTarget)` again for JUST the current letter to get fresh match info
- **Impact:** This was the final missing piece - without it, no scores would ever save
- **Files Modified:** `index-4.0.html` (lines 4494-4518)
- **Commit:** 3286751

#### 5. Enhanced Debug Logging
- **Added comprehensive logging throughout the scoring pipeline:**
  - Snapshot lookup attempts (object reference vs data comparison)
  - Data mismatch details (first 10 values + differences)
  - Score increment conditions checking
  - Target matching validation
  - Fresh match info retrieval confirmation
- **Created diagnostic tools:**
  - `test-score-persistence.cjs` - Query database for all scores
  - `check-recent-scores.cjs` - Show recent score updates with timestamps
  - `find-profile-v3.cjs` - Find calibrations by profile ID prefix
  - `check-letter-case.cjs` - Verify letter case in database

### Technical Details

#### Scoring Pipeline (Fixed)
```
1. testAllPlosiveStrategies() loops through ALL letters (a-z)
   └→ Calls strategy11_simpleSnapshot() for each letter
   └→ window.lastMatchInfo overwritten 26 times
   └→ Result: lastMatchInfo.target = last letter in loop (stale)

2. Success detected for currentTarget
   └→ Call strategy11_simpleSnapshot(patternBuffer, currentTarget) AGAIN
   └→ window.lastMatchInfo now fresh for currentTarget

3. Validate lastMatchInfo.target === currentTarget
   └→ If match: increment score
   └→ If no match: log error and skip

4. debounceSaveScores(letter, profileId)
   └→ Add to pendingSaves Set
   └→ Start 2-second timer

5. On letter change/tab switch/page unload:
   └→ flushAllPendingScores()
   └→ Save immediately to database
```

#### Database Save Flow (Fixed)
```
1. Filter snapshots by profileId (cross-profile pooling)
2. Build pattern_data object with updated scores
3. UPDATE calibrations
   SET pattern_data = {...}, updated_at = now()
   WHERE profile_id = ? AND letter ILIKE ? ← Case-insensitive!
```

#### Bugs Timeline
- **Before 08:46 AM:** All 4 bugs active, NO scores saving
- **08:46 AM:** Case-insensitive fix deployed (bug #2 fixed)
- **08:50 AM:** Target validation added (bug #3 detected)
- **09:00 AM:** Fresh match info fix deployed (bug #4 fixed)
- **Result:** Scores NOW saving correctly! ✅

### Database Verification
Before fix (profile 69420205):
```
M: score=0, updated 07:09 AM (over 1 hour ago)
E: score=0, updated 07:09 AM
S: score=0, updated 07:09 AM
```

After fix (profile 69420205):
```
✅ J: score=2, updated 08:57 AM (success!)
✅ K: score=9, updated 08:56 AM (success!)
```

### Commits
1. `de82045` - Add score flushing on letter change and tab switch
2. `f86733a` - Add detailed logging to snapshot score increment
3. `791d337` - Show actual data values when comparison fails
4. `8e28b98` - Use lastMatchInfo.target instead of currentTarget
5. `4255e28` - Use case-insensitive letter matching (ilike)
6. `23d07f7` - Verify lastMatchInfo.target matches currentTarget
7. `3286751` - Call strategy again after success to get fresh lastMatchInfo (CRITICAL FIX)

### Deployment
All changes deployed to:
- **Production URL:** https://phuketcamp.com/phonics4/
- **DRC Repo:** 7 commits
- **Phuket-Camps Repo:** 7 corresponding commits
- **Auto-Deploy:** Netlify triggered successfully

### User Confirmation
- User tested multiple letters (M, E, S) in manual mode
- Console logs showed correct scoring pipeline
- User confirmed: "it works!"
- Cross-profile pooling verified: loads calibrations from ALL profiles, each snapshot tracks its `profileId`

### Key Learnings
1. **Debounced saves need explicit flushing** - Can't rely on timers alone for critical persistence
2. **Case sensitivity matters** - PostgreSQL `.eq()` is case-sensitive, use `.ilike()` for text
3. **Global state is fragile** - `window.lastMatchInfo` overwritten by loops, need validation
4. **Strategy loops require fresh calls** - Testing all letters pollutes global state, must refresh
5. **Layer by layer debugging** - Multiple bugs masked each other, fixed each one sequentially

### Next Steps
- Monitor score accumulation during real gameplay
- Verify scores persist across page refreshes
- Consider removing global `window.lastMatchInfo` in favor of return values
- Potential optimization: Cache strategy results to avoid double-calling
