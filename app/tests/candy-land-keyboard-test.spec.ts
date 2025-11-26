import { test, expect } from '@playwright/test';

test('candy land keyboard shooting in test mode', async ({ page }) => {
  // Capture console logs
  const logs: string[] = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);
    console.log(`[Browser]: ${text}`);
  });

  console.log('Loading candy land with test mode...');
  await page.goto('/games/candy-land?test', { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Wait for game to load
  await page.waitForSelector('text=Candy Land', { timeout: 10000 });
  console.log('✅ Game loaded');

  // Click start button
  const startButton = page.locator('button:has-text("Start Game")');
  await expect(startButton).toBeVisible({ timeout: 5000 });
  await startButton.click();
  console.log('✅ Clicked start button');

  // Wait for game to start
  await page.waitForSelector('button:has-text("Stop")', { timeout: 5000 });
  console.log('✅ Game started');

  // Get initial state
  const initialState = await page.evaluate(() => {
    const scoreMatch = document.body.textContent?.match(/Score:\s*(\d+)/);
    const wavesMatch = document.body.textContent?.match(/Wave:\s*(\d+)/);
    return {
      score: scoreMatch ? parseInt(scoreMatch[1]) : 0,
      wave: wavesMatch ? parseInt(wavesMatch[1]) : 1
    };
  });
  console.log('Initial state:', initialState);

  // Wait for letters to spawn
  console.log('Waiting 5 seconds for letters to spawn...');
  await page.waitForTimeout(5000);

  // Check how many letter images are on screen
  const letterCount = await page.locator('img[src^="/images/candy-land/letters/"]').count();
  console.log(`Found ${letterCount} letter images on screen`);

  // Press SPACE 10 times
  console.log('Pressing SPACE 10 times...');
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
  }

  // Wait for state to update
  await page.waitForTimeout(1000);

  // Get final state
  const finalState = await page.evaluate(() => {
    const scoreMatch = document.body.textContent?.match(/Score:\s*(\d+)/);
    const wavesMatch = document.body.textContent?.match(/Wave:\s*(\d+)/);
    return {
      score: scoreMatch ? parseInt(scoreMatch[1]) : 0,
      wave: wavesMatch ? parseInt(wavesMatch[1]) : 1
    };
  });
  console.log('Final state:', finalState);

  // Check for handleLetterMatch calls in logs
  const letterMatchLogs = logs.filter(log =>
    log.includes('handleLetterMatch') ||
    log.includes('TEST MODE') ||
    log.includes('Matched letter')
  );
  console.log('\nLetter match logs:', letterMatchLogs);

  // Report results
  const scoreChange = finalState.score - initialState.score;
  console.log(`\n📊 Score change: ${initialState.score} → ${finalState.score} (${scoreChange >= 0 ? '+' : ''}${scoreChange})`);

  if (scoreChange > 0) {
    console.log('✅ SUCCESS: Shooting works! Score increased by', scoreChange);
  } else {
    console.log('⚠️ No score change detected');
    console.log('This might mean:');
    console.log('  1. No letters spawned yet');
    console.log('  2. Letters spawned but none matched the target');
    console.log('  3. Shooting mechanic has a bug');
  }

  // Take screenshot
  await page.screenshot({ path: '/Users/marcschwyn/Desktop/projects/DRC/app/candy-land-keyboard-test.png' });
  console.log('Screenshot saved to candy-land-keyboard-test.png');
});
