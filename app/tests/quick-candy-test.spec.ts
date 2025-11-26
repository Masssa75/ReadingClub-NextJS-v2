import { test, expect } from '@playwright/test';

test('candy land page loads', async ({ page }) => {
  console.log('Loading candy land with test mode...');
  await page.goto('/games/candy-land?test', { waitUntil: 'domcontentloaded', timeout: 30000 });
  console.log('Page loaded!');

  // Wait for the page to be interactive
  await page.waitForSelector('text=Candy Land', { timeout: 10000 });
  console.log('Found Candy Land title');

  // Click start button
  const startButton = page.locator('button:has-text("Start Game")');
  await expect(startButton).toBeVisible({ timeout: 5000 });
  console.log('Start button visible');

  await startButton.click();
  console.log('Clicked start button');

  // Wait for game to start
  await page.waitForSelector('button:has-text("Stop")', { timeout: 5000 });
  console.log('Game started! Stop button visible');

  // Wait for letters to spawn (check debug panel)
  await page.waitForTimeout(5000);

  // Press SPACE to shoot
  console.log('Pressing SPACE to shoot...');
  await page.keyboard.press('Space');

  // Wait and check if something happened
  await page.waitForTimeout(2000);

  console.log('Test complete!');
});
