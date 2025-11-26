import { test, expect } from '@playwright/test';

test('check if letters are actually moving', async ({ page }) => {
  // Capture console logs
  const logs: string[] = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);
    // Print logs containing our debug markers
    if (text.includes('🎨') || text.includes('📝') || text.includes('Spawned') || text.includes('SPAWN')) {
      console.log('[Browser]:', text);
    }
  });

  await page.goto('/games/candy-land', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('text=Candy Land', { timeout: 10000 });

  // Start game
  const startButton = page.locator('button:has-text("Start Game")');
  await startButton.click();
  await page.waitForSelector('button:has-text("Stop")', { timeout: 5000 });

  console.log('✅ Game started, waiting for letters to spawn and move...');

  // Wait 10 seconds for first letter to spawn (at 7.5 seconds)
  await page.waitForTimeout(10000);

  console.log('\n🔍 Checking letter positions from spawned logs...');

  // Extract spawned letter logs
  const spawnedLogs = logs.filter(log => log.includes('Spawned letter:'));
  console.log(`Found ${spawnedLogs.length} spawned letters`);

  spawnedLogs.forEach((log, i) => {
    console.log(`  Letter ${i + 1}:`, log);
  });

  // Check DOM for letter elements
  const letterDivs = await page.locator('div').filter({ has: page.locator('img[src*="/images/candy-land/letters/"]') }).count();
  console.log(`\n📊 Found ${letterDivs} letter container divs in DOM`);

  // Try to get letter positions from DOM
  const letterPositions = await page.evaluate(() => {
    const letterContainers = Array.from(document.querySelectorAll('img[src*="/images/candy-land/letters/"]'))
      .map(img => img.closest('div'))
      .filter((div): div is HTMLElement => div !== null);

    return letterContainers.map(div => ({
      top: div.style.top,
      left: div.style.left,
      visible: div.getBoundingClientRect().top >= 0 && div.getBoundingClientRect().top <= window.innerHeight
    }));
  });

  console.log('\n📍 Letter positions in DOM:');
  letterPositions.forEach((pos, i) => {
    console.log(`  Letter ${i + 1}: top=${pos.top}, left=${pos.left}, visible=${pos.visible}`);
  });

  // Take screenshot
  await page.screenshot({ path: '/Users/marcschwyn/Desktop/projects/DRC/app/candy-land-movement-test.png' });
  console.log('\n📸 Screenshot saved');
});
