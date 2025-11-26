import { test, expect } from '@playwright/test';

test.describe('Candy Land Game - Full Game Test', () => {
  test('should play the game and verify shooting works', async ({ page }) => {
    // Capture console logs
    const logs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      logs.push(text);
      if (text.includes('🎯') || text.includes('✅') || text.includes('❌')) {
        console.log(`[Browser]: ${text}`);
      }
    });

    console.log('\n🎮 CANDY LAND GAME TEST');
    console.log('=' .repeat(50));

    // Navigate to game in TEST MODE
    console.log('\n1️⃣ Loading game in test mode...');
    await page.goto('/games/candy-land?test');
    await page.waitForLoadState('networkidle');

    // Verify we're in test mode
    const menuText = await page.locator('text=TEST MODE').count();
    if (menuText > 0) {
      console.log('✅ Test mode enabled (keyboard controls active)');
    } else {
      console.log('⚠️ Not seeing test mode indicator, but proceeding...');
    }

    // Start the game
    console.log('\n2️⃣ Starting game...');
    const startButton = page.locator('button:has-text("Start Game")');
    await expect(startButton).toBeVisible({ timeout: 5000 });
    await startButton.click();
    console.log('✅ Clicked Start Game button');

    // Wait for game to start
    await page.waitForTimeout(1000);

    // Verify game started
    const stopButton = page.locator('button:has-text("Stop")');
    await expect(stopButton).toBeVisible();
    console.log('✅ Game is running (Stop button visible)');

    // Get initial debug state
    const getDebugState = async () => {
      return await page.evaluate(() => {
        const debugPanel = document.querySelector('div:has-text("State:")');
        if (!debugPanel) return null;

        const text = debugPanel.textContent || '';
        return {
          state: text.match(/State: (\w+)/)?.[1],
          lives: parseInt(text.match(/Lives: (\d+)/)?.[1] || '0'),
          score: parseInt(text.match(/Score: (\d+)/)?.[1] || '0'),
          wave: parseInt(text.match(/Wave: (\d+)/)?.[1] || '0'),
          target: text.match(/Target: (\w*)/)?.[1] || '',
          activeLetters: parseInt(text.match(/Active letters: (\d+)/)?.[1] || '0'),
        };
      });
    };

    let state = await getDebugState();
    console.log('\n3️⃣ Initial game state:', state);

    // Wait for letters to spawn
    console.log('\n4️⃣ Waiting for letters to spawn...');
    let attempts = 0;
    while (attempts < 20) {
      await page.waitForTimeout(500);
      state = await getDebugState();
      if (state && state.activeLetters > 0) {
        console.log(`✅ Letters spawned! Active letters: ${state.activeLetters}, Target: ${state.target}`);
        break;
      }
      attempts++;
    }

    if (!state || state.activeLetters === 0) {
      console.log('❌ No letters spawned after 10 seconds');
      throw new Error('Letters did not spawn');
    }

    // Get initial score
    const initialScore = state.score;
    const initialLives = state.lives;
    const initialActiveLetters = state.activeLetters;

    console.log('\n5️⃣ Testing shooting mechanic...');
    console.log(`   Target: ${state.target}`);
    console.log(`   Active letters before shoot: ${initialActiveLetters}`);
    console.log(`   Score before shoot: ${initialScore}`);
    console.log('   Pressing SPACE to shoot...');

    // Press SPACE to shoot
    await page.keyboard.press('Space');

    // Wait for the shot to register
    await page.waitForTimeout(1000);

    // Check if letter was hit
    const afterShoot = await getDebugState();
    console.log('\n6️⃣ After shooting:');
    console.log(`   Active letters: ${afterShoot?.activeLetters} (was ${initialActiveLetters})`);
    console.log(`   Score: ${afterShoot?.score} (was ${initialScore})`);

    // Verify shooting worked
    const scoreIncreased = (afterShoot?.score || 0) > initialScore;
    const letterRemoved = (afterShoot?.activeLetters || 0) < initialActiveLetters;

    if (scoreIncreased) {
      console.log('✅ SCORE INCREASED - Shooting works!');
    } else {
      console.log('❌ Score did not increase');
    }

    if (letterRemoved) {
      console.log('✅ LETTER REMOVED - Shooting works!');
    } else {
      console.log('❌ Letter was not removed');
    }

    // Check logs for handleLetterMatch
    const handleLetterMatchLogs = logs.filter(log =>
      log.includes('🎯 handleLetterMatch') ||
      log.includes('Matched letter:')
    );

    console.log('\n7️⃣ HandleLetterMatch logs:');
    handleLetterMatchLogs.forEach(log => console.log(`   ${log}`));

    // Test multiple shots
    console.log('\n8️⃣ Testing multiple shots...');
    for (let i = 0; i < 3; i++) {
      await page.waitForTimeout(2000);
      const before = await getDebugState();

      if (before && before.activeLetters > 0) {
        console.log(`\n   Shot ${i + 1}: Target=${before.target}, ActiveLetters=${before.activeLetters}`);
        await page.keyboard.press('Space');
        await page.waitForTimeout(500);

        const after = await getDebugState();
        const hit = (after?.score || 0) > (before?.score || 0);
        console.log(`   Result: ${hit ? '✅ HIT' : '❌ MISS'} (Score: ${before.score} → ${after?.score})`);
      }
    }

    // Final state
    const finalState = await getDebugState();
    console.log('\n9️⃣ Final game state:');
    console.log(`   Lives: ${finalState?.lives} (started with ${initialLives})`);
    console.log(`   Score: ${finalState?.score} (started with ${initialScore})`);
    console.log(`   Wave: ${finalState?.wave}`);

    console.log('\n' + '='.repeat(50));
    console.log('🎮 TEST COMPLETE');
    console.log('='.repeat(50) + '\n');

    // Assertions
    expect(scoreIncreased || letterRemoved).toBe(true);
  });
});
