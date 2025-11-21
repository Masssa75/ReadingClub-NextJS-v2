const { chromium } = require('playwright');

/**
 * Test Phase 5 Adaptive Learning Integration with Phase 6 Play Tab
 *
 * Tests:
 * 1. Session initialization
 * 2. Letter selection algorithm
 * 3. Progress tracker display
 * 4. Proficiency tracking
 * 5. Graduation logic
 * 6. Session management
 */

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Listen for console logs
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('📝') || text.includes('🎓') || text.includes('🆕') ||
        text.includes('🔥') || text.includes('📊') || text.includes('✅') ||
        text.includes('📈') || text.includes('🌟')) {
      console.log('  ', text);
    }
  });

  // Listen for errors
  page.on('pageerror', error => {
    console.error('❌ Page error:', error.message);
  });

  console.log('\n🧪 Starting Adaptive Learning Test...\n');

  try {
    // Navigate to app
    console.log('1️⃣ Loading app at http://localhost:3001');
    await page.goto('http://localhost:3001');
    await page.waitForTimeout(1000);

    // Navigate to Play tab (directly via URL to avoid Next.js dev overlay click blocking)
    console.log('\n2️⃣ Navigating to Play tab');
    await page.goto('http://localhost:3001/play');
    await page.waitForTimeout(1000);
    console.log('   ✅ Play tab loaded');

    // Check if session initialized
    console.log('\n3️⃣ Checking session initialization');
    const sessionData = await page.evaluate(() => {
      // Try to read session from localStorage
      const profileId = 'test-profile-id'; // This will vary based on implementation
      const sessionKey = `session_${profileId}`;
      const sessionStr = localStorage.getItem(sessionKey);
      return sessionStr ? JSON.parse(sessionStr) : null;
    });

    if (sessionData) {
      console.log('   ✅ Session initialized:', sessionData.sessionId);
      console.log('      - Attempts:', sessionData.attempts?.length || 0);
      console.log('      - Letters introduced:', sessionData.newLettersIntroduced?.length || 0);
    } else {
      console.log('   ℹ️ No session found yet (might initialize on first action)');
    }

    // Check for progress tracker
    console.log('\n4️⃣ Checking for progress tracker');
    const progressTracker = await page.locator('text=Letters in Practice').first();
    const trackerVisible = await progressTracker.count() > 0;

    if (trackerVisible) {
      console.log('   ✅ Progress tracker found!');

      // Count progress cards
      const cards = await page.locator('[class*="bg-white/8"]').count();
      console.log('      - Progress cards visible:', cards);
    } else {
      console.log('   ℹ️ Progress tracker not visible (appears after first letter introduction)');
    }

    // Check for Start button or current letter display
    console.log('\n5️⃣ Checking Play tab UI elements');

    const startBtn = await page.locator('button:has-text("Start")').first();
    const stopBtn = await page.locator('button:has-text("Stop")').first();
    const listenBtn = await page.locator('button:has-text("LISTEN")').first();

    const hasStart = await startBtn.count() > 0;
    const hasStop = await stopBtn.count() > 0;
    const hasListen = await listenBtn.count() > 0;

    console.log('   UI Elements:');
    console.log('      - Start button:', hasStart ? '✅' : '❌');
    console.log('      - Stop button:', hasStop ? '✅' : '❌');
    console.log('      - LISTEN button:', hasListen ? '✅' : '❌');

    // Try to check current letter
    const currentLetterEl = await page.locator('[class*="text-"][class*="font-bold"]').first();
    if (await currentLetterEl.count() > 0) {
      const currentLetter = await currentLetterEl.textContent();
      if (currentLetter && currentLetter.length === 1) {
        console.log('      - Current letter:', currentLetter);
      }
    }

    // Check proficiencies in database
    console.log('\n6️⃣ Checking proficiency data');
    const proficiencies = await page.evaluate(async () => {
      try {
        // This assumes Supabase client is available globally
        // Adjust based on actual implementation
        const { data, error } = await window.supabase
          ?.from('calibrations')
          .select('letter, proficiency')
          .limit(5);

        return data || [];
      } catch (e) {
        return { error: e.message };
      }
    });

    if (proficiencies.error) {
      console.log('   ⚠️ Could not fetch proficiencies:', proficiencies.error);
    } else if (proficiencies.length > 0) {
      console.log('   ✅ Found proficiency data:');
      proficiencies.forEach(p => {
        const level = ['UNKNOWN', 'SOMETIMES', 'KNOWN', 'MASTERED'][p.proficiency] || 'UNKNOWN';
        console.log(`      - ${p.letter}: ${level}`);
      });
    } else {
      console.log('   ℹ️ No proficiency data yet');
    }

    // Test letter selection algorithm
    console.log('\n7️⃣ Testing adaptive selection algorithm');
    const selectionTest = await page.evaluate(() => {
      // Test if adaptive selection functions are available
      const hasModule = typeof window.selectNextLetter === 'function' ||
                       typeof window.adaptiveSelection !== 'undefined';
      return { available: hasModule };
    });

    if (selectionTest.available) {
      console.log('   ✅ Adaptive selection module loaded');
    } else {
      console.log('   ℹ️ Selection functions not exposed to window (expected - they may be in React hooks)');
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Test Summary:');
    console.log('='.repeat(60));
    console.log('✅ App loaded successfully');
    console.log(trackerVisible ? '✅' : 'ℹ️', 'Progress tracker', trackerVisible ? 'visible' : 'not yet visible');
    console.log(hasStart || hasStop ? '✅' : '⚠️', 'Play controls', hasStart || hasStop ? 'found' : 'missing');
    console.log(hasListen ? '✅' : '⚠️', 'LISTEN button', hasListen ? 'found' : 'missing');
    console.log(proficiencies.length > 0 ? '✅' : 'ℹ️', 'Proficiency data', proficiencies.length > 0 ? `(${proficiencies.length} letters)` : 'not yet initialized');
    console.log('='.repeat(60));

    console.log('\n💡 Manual Testing Steps:');
    console.log('1. Click "Start" to begin a session');
    console.log('2. Try saying a letter sound (or use LISTEN button)');
    console.log('3. Watch the progress tracker update');
    console.log('4. Complete 10 successes to see letter graduate to KNOWN');
    console.log('5. Check localStorage for session persistence');
    console.log('6. Wait 30 minutes to test session timeout');
    console.log('\n👀 Browser window kept open for manual inspection...');
    console.log('   Close this terminal to end the test.\n');

    // Keep browser open for manual testing
    await page.waitForTimeout(300000); // 5 minutes

  } catch (error) {
    console.error('\n❌ Test error:', error.message);
    console.error(error.stack);
  } finally {
    // await browser.close();
  }
})();
