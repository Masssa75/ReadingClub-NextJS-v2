import { test, expect } from '@playwright/test';

test.describe('Candy Land Game - Debug Console Logs', () => {
  test('should show detailed console logs and calibration loading', async ({ page }) => {
    // Capture all console messages
    const consoleLogs: string[] = [];
    const consoleErrors: string[] = [];

    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push(`[${msg.type()}] ${text}`);
      console.log(`Browser Console [${msg.type()}]:`, text);
    });

    page.on('pageerror', error => {
      consoleErrors.push(error.message);
      console.error('Browser Error:', error.message);
    });

    // Navigate to the game
    console.log('\n🎮 Navigating to Candy Land game...');
    await page.goto('/games/candy-land');

    // Wait for page to load
    await page.waitForLoadState('networkidle');
    console.log('✅ Page loaded\n');

    // Wait a bit for React to initialize and run useEffect
    await page.waitForTimeout(2000);

    // Check for profile-related logs
    const profileLogs = consoleLogs.filter(log =>
      log.includes('profile') || log.includes('Profile') || log.includes('Loading calibrations')
    );
    console.log('\n📊 Profile-related logs:');
    profileLogs.forEach(log => console.log('  ', log));

    // Check for calibration-related logs
    const calibrationLogs = consoleLogs.filter(log =>
      log.includes('calibration') || log.includes('Calibration') || log.includes('Loaded')
    );
    console.log('\n📊 Calibration-related logs:');
    calibrationLogs.forEach(log => console.log('  ', log));

    // Check debug info panel
    const debugPanel = page.locator('text=/Calibrated: \\d+/');
    if (await debugPanel.isVisible()) {
      const debugText = await debugPanel.textContent();
      console.log('\n🔍 Debug panel shows:', debugText);
    }

    // Check what profile is active
    const profileInfo = await page.evaluate(() => {
      return {
        localStorage_currentProfile: localStorage.getItem('currentProfile'),
        localStorage_guestProfileId: localStorage.getItem('guestProfileId'),
      };
    });
    console.log('\n💾 localStorage state:', profileInfo);

    // Check if there are any errors
    if (consoleErrors.length > 0) {
      console.log('\n❌ Errors found:');
      consoleErrors.forEach(err => console.log('  ', err));
    }

    // Check Supabase connection by querying calibrations directly
    const calibrationCount = await page.evaluate(async () => {
      try {
        // Import supabase client
        const { createClient } = await import('@supabase/supabase-js');
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

        if (!supabaseUrl || !supabaseKey) {
          return { error: 'Supabase env vars not set' };
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // Get all calibrations
        const { data, error } = await supabase.from('calibrations').select('letter, profile_id');

        if (error) {
          return { error: error.message };
        }

        return {
          total: data?.length || 0,
          letters: data?.map(c => c.letter).join(', '),
          profiles: [...new Set(data?.map(c => c.profile_id))].length
        };
      } catch (err) {
        return { error: String(err) };
      }
    });

    console.log('\n📊 Direct Supabase query result:', calibrationCount);

    // Print full console log for debugging
    console.log('\n📝 Full console log:');
    consoleLogs.forEach(log => console.log('  ', log));

    // The test passes - we just want to see the logs
    expect(true).toBe(true);
  });
});
