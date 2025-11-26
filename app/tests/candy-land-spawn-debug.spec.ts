import { test, expect } from '@playwright/test';

test('debug candy land letter spawning', async ({ page }) => {
  // Capture ALL console logs
  const logs: string[] = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);
    console.log(`[Browser]: ${text}`);
  });

  console.log('🧪 Loading Candy Land game...');
  await page.goto('/games/candy-land', { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Wait for game to load
  await page.waitForSelector('text=Candy Land', { timeout: 10000 });
  console.log('✅ Game loaded');

  // Click start button
  const startButton = page.locator('button:has-text("Start Game")');
  await expect(startButton).toBeVisible({ timeout: 5000 });
  await startButton.click();
  console.log('✅ Clicked Start Game button');

  // Wait for game to start
  await page.waitForSelector('button:has-text("Stop")', { timeout: 5000 });
  console.log('✅ Game started, Stop button visible');

  // Wait 15 seconds to let spawn timer count up
  console.log('⏳ Waiting 15 seconds for letters to spawn...');
  await page.waitForTimeout(15000);

  // Check for falling letters on screen
  const letterCount = await page.locator('img[src^="/images/candy-land/letters/"]').count();
  console.log(`\n📊 Found ${letterCount} letter images on screen`);

  // Filter and display relevant logs
  console.log('\n📝 === GAME START LOGS ===');
  logs.filter(log => log.includes('START GAME')).forEach(log => console.log('  ', log));

  console.log('\n📝 === GAME LOOP LOGS ===');
  logs.filter(log => log.includes('Game loop')).forEach(log => console.log('  ', log));

  console.log('\n📝 === TARGET LETTER LOGS ===');
  logs.filter(log => log.includes('Target letter')).forEach(log => console.log('  ', log));

  console.log('\n📝 === SPAWN CHECK LOGS (last 10) ===');
  const spawnChecks = logs.filter(log => log.includes('SPAWN CHECK'));
  spawnChecks.slice(-10).forEach(log => console.log('  ', log));

  console.log('\n📝 === SPAWN LETTER LOGS ===');
  logs.filter(log => log.includes('spawnLetter') || log.includes('SPAWNING')).forEach(log => console.log('  ', log));

  console.log('\n📝 === SPAWNED LETTER LOGS ===');
  logs.filter(log => log.includes('Spawned letter:')).forEach(log => console.log('  ', log));

  // Get current game state from page
  const gameInfo = await page.evaluate(() => {
    const scoreMatch = document.body.textContent?.match(/Score:\s*(\d+)/);
    const waveMatch = document.body.textContent?.match(/Wave:\s*(\d+)/);
    const livesMatch = document.body.textContent?.match(/💖/g);
    return {
      score: scoreMatch ? parseInt(scoreMatch[1]) : 0,
      wave: waveMatch ? parseInt(waveMatch[1]) : 1,
      lives: livesMatch ? livesMatch.length : 0
    };
  });

  console.log('\n📊 === FINAL GAME STATE ===');
  console.log('  Score:', gameInfo.score);
  console.log('  Wave:', gameInfo.wave);
  console.log('  Lives:', gameInfo.lives);
  console.log('  Letters on screen:', letterCount);

  // Take screenshot
  await page.screenshot({ path: '/Users/marcschwyn/Desktop/projects/DRC/app/candy-land-spawn-debug.png' });
  console.log('\n📸 Screenshot saved to candy-land-spawn-debug.png');

  // Analysis
  if (letterCount === 0) {
    console.log('\n❌ PROBLEM: No letters spawned!');
    console.log('Checking spawn conditions from logs...');

    const lastSpawnCheck = spawnChecks[spawnChecks.length - 1];
    if (lastSpawnCheck) {
      console.log('Last spawn check:', lastSpawnCheck);
    }
  } else {
    console.log('\n✅ Letters are spawning correctly!');
  }
});
