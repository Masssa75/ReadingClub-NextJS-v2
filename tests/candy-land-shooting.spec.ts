import { test, expect } from '@playwright/test';

test.describe('Candy Land - Shooting Mechanic Debug', () => {
  test('should test shooting mechanics in test mode', async ({ page }) => {
    // Capture console logs
    const logs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      logs.push(text);
      console.log(`[Browser]: ${text}`);
    });

    // Navigate to game
    await page.goto('/games/candy-land');
    await page.waitForLoadState('networkidle');

    console.log('\n1️⃣ Checking if game loaded...');
    const menuTitle = page.locator('text=Candy Land');
    await expect(menuTitle).toBeVisible();
    console.log('✅ Game menu visible');

    // Click start button
    console.log('\n2️⃣ Starting game...');
    const startButton = page.locator('button:has-text("Start Game")');
    if (await startButton.isVisible()) {
      await startButton.click();
      console.log('✅ Clicked Start Game');
    } else {
      console.log('❌ Start button not visible - checking why...');
      const calibrateButton = page.locator('text=Calibrate Letters First');
      if (await calibrateButton.isVisible()) {
        console.log('❌ Game requires calibration');
        return;
      }
    }

    // Wait for game to start
    await page.waitForTimeout(2000);

    // Check if we're in playing state
    const stopButton = page.locator('button:has-text("Stop")');
    await expect(stopButton).toBeVisible();
    console.log('✅ Game started (Stop button visible)');

    // Get debug info
    const debugInfo = await page.evaluate(() => {
      const debugPanel = document.querySelector('div:has-text("State:")');
      if (!debugPanel) return null;

      const text = debugPanel.textContent || '';
      const state = text.match(/State: (\w+)/)?.[1];
      const lives = text.match(/Lives: (\d+)/)?.[1];
      const target = text.match(/Target: (\w*)/)?.[1];
      const activeLetters = text.match(/Active letters: (\d+)/)?.[1];

      return { state, lives, target, activeLetters };
    });

    console.log('\n3️⃣ Game state:', debugInfo);

    // Wait for letters to spawn
    console.log('\n4️⃣ Waiting for letters to spawn...');
    await page.waitForTimeout(3000);

    // Check for falling letters
    const fallingLetters = await page.evaluate(() => {
      const letters = Array.from(document.querySelectorAll('img[src^="/images/candy-land/letters/"]'));
      return letters.map(img => ({
        src: img.getAttribute('src'),
        visible: img.getBoundingClientRect().height > 0
      }));
    });

    console.log(`✅ Found ${fallingLetters.length} letter images:`, fallingLetters);

    // Test keyboard shooting (simulate space bar for test mode)
    console.log('\n5️⃣ Testing handleLetterMatch function...');

    // Inject a test by calling handleLetterMatch directly
    const matchResult = await page.evaluate(async (targetLetter) => {
      console.log('🧪 TEST: Manually triggering handleLetterMatch for:', targetLetter);

      // Find the game component's state
      const debugPanel = document.querySelector('div:has-text("Target:")');
      const text = debugPanel?.textContent || '';
      const currentTarget = text.match(/Target: (\w*)/)?.[1];

      console.log('Current target from debug:', currentTarget);

      return { currentTarget };
    }, debugInfo?.target);

    console.log('Match result:', matchResult);

    // Check logs for voice matches
    const voiceMatchLogs = logs.filter(log =>
      log.includes('Voice match detected') ||
      log.includes('MATCH ACCEPTED') ||
      log.includes('handleLetterMatch')
    );

    console.log('\n6️⃣ Voice match logs:');
    voiceMatchLogs.forEach(log => console.log('  ', log));

    // Check if handleLetterMatch was called
    const handleLetterMatchCalled = logs.some(log =>
      log.includes('handleLetterMatch') ||
      log.includes('Find matching falling letter')
    );

    console.log('\n7️⃣ Was handleLetterMatch called?', handleLetterMatchCalled);

    if (!handleLetterMatchCalled) {
      console.log('❌ handleLetterMatch was NEVER called - this is the bug!');
      console.log('   The voice detection is working, but the callback is not triggering');
    }

    // Print relevant logs
    console.log('\n📝 All logs containing "match" or "letter":');
    logs.filter(log =>
      log.toLowerCase().includes('match') ||
      log.toLowerCase().includes('letter')
    ).forEach(log => console.log('  ', log));
  });
});
