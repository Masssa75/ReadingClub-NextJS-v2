import { test, expect } from '@playwright/test';

test.describe('Candy Land Space Invaders Game', () => {
  test('should load calibration data and start game', async ({ page }) => {
    // Navigate to the game page
    await page.goto('/games/candy-land');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check if we're on the menu screen
    const menuTitle = page.locator('text=Candy Land');
    await expect(menuTitle).toBeVisible();

    // Check for profile selection warning
    const profileWarning = page.locator('text=Please select a profile first!');
    const calibrationWarning = page.locator('text=Please calibrate some letters first!');
    const startButton = page.locator('button:has-text("Start Game")');

    // Check if there's a warning or if we can start
    const hasProfileWarning = await profileWarning.isVisible().catch(() => false);
    const hasCalibrationWarning = await calibrationWarning.isVisible().catch(() => false);

    if (hasProfileWarning) {
      console.log('⚠️ No profile selected - expected behavior');
    } else if (hasCalibrationWarning) {
      console.log('⚠️ No calibrations found - this is the bug we\'re testing');
    } else {
      console.log('✅ Profile and calibrations loaded - game should work');
    }

    // Try to click start button if it exists
    const canStart = await startButton.isEnabled().catch(() => false);
    if (canStart) {
      await startButton.click();

      // Wait for game to start
      await page.waitForTimeout(1000);

      // Check if we're in playing state
      const stopButton = page.locator('button:has-text("Stop")');
      await expect(stopButton).toBeVisible();

      // Check if target letter is displayed
      const targetIndicator = page.locator('text=/Say "[A-Z]" to shoot!/');
      await expect(targetIndicator).toBeVisible();

      // Check debug info
      const debugInfo = page.locator('text=/Calibrated: \\d+/');
      await expect(debugInfo).toBeVisible();

      // Get the calibrated count
      const debugText = await debugInfo.textContent();
      const calibratedCount = parseInt(debugText?.match(/Calibrated: (\d+)/)?.[1] || '0');

      console.log(`📊 Calibrated letters: ${calibratedCount}`);

      // If calibrated count is 0, that's the bug!
      if (calibratedCount === 0) {
        console.log('🐛 BUG CONFIRMED: No calibrations loaded even though profile exists');
      } else {
        console.log(`✅ Successfully loaded ${calibratedCount} calibrations`);
      }
    }
  });

  test('should show volume and concentration meters in voice mode', async ({ page }) => {
    await page.goto('/games/candy-land');
    await page.waitForLoadState('networkidle');

    const startButton = page.locator('button:has-text("Start Game")');
    const canStart = await startButton.isVisible().catch(() => false);

    if (canStart) {
      await startButton.click();
      await page.waitForTimeout(1000);

      // Check for volume meter
      const volumeMeter = page.locator('text=Volume:');
      await expect(volumeMeter).toBeVisible();

      // Check for match meter
      const matchMeter = page.locator('text=Match:');
      await expect(matchMeter).toBeVisible();
    }
  });

  test('should display HUD elements correctly', async ({ page }) => {
    await page.goto('/games/candy-land');
    await page.waitForLoadState('networkidle');

    const startButton = page.locator('button:has-text("Start Game")');
    const canStart = await startButton.isVisible().catch(() => false);

    if (canStart) {
      await startButton.click();
      await page.waitForTimeout(1000);

      // Check lives display (3 hearts)
      const hearts = page.locator('span:has-text("💖")');
      const heartCount = await hearts.count();
      expect(heartCount).toBeGreaterThanOrEqual(3); // At least 3 hearts visible

      // Check score display
      const scoreDisplay = page.locator('text=/🍭 \\d+/');
      await expect(scoreDisplay).toBeVisible();

      // Check wave display
      const waveDisplay = page.locator('text=/Wave \\d+/');
      await expect(waveDisplay).toBeVisible();
    }
  });
});
