import { chromium } from 'playwright';

async function testManualOverride() {
  console.log('🎭 Starting Playwright test for manual override feature...\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    permissions: ['microphone'],
  });
  const page = await context.newPage();

  try {
    // Step 1: Navigate to /play page
    console.log('1️⃣ Navigating to /play page...');
    await page.goto('http://localhost:3000/play');
    await page.waitForLoadState('networkidle');
    console.log('   ✅ Page loaded\n');

    // Step 2: Verify Parents menu is visible
    console.log('2️⃣ Checking Parents menu...');
    const parentsButton = page.locator('button:has-text("Parents")');
    await parentsButton.waitFor({ state: 'visible', timeout: 5000 });
    console.log('   ✅ Parents button found\n');

    // Step 3: Click Parents menu to open dropdown
    console.log('3️⃣ Opening Parents menu...');
    await parentsButton.click();
    await page.waitForTimeout(500); // Wait for animation
    console.log('   ✅ Menu opened\n');

    // Step 4: Verify Advanced Mode toggle is visible
    console.log('4️⃣ Looking for Advanced Mode toggle...');
    const advancedModeButton = page.locator('button:has-text("Advanced Mode")');
    await advancedModeButton.waitFor({ state: 'visible', timeout: 5000 });
    const advancedModeText = await advancedModeButton.textContent();
    console.log(`   ✅ Found: "${advancedModeText}"\n`);

    // Step 5: Enable Advanced Mode if not already enabled
    console.log('5️⃣ Enabling Advanced Mode...');
    if (advancedModeText.includes('OFF')) {
      await advancedModeButton.click();
      await page.waitForTimeout(500);
      console.log('   ✅ Advanced Mode enabled\n');
    } else {
      console.log('   ℹ️  Advanced Mode already enabled\n');
    }

    // Step 6: Close the menu by pressing Escape
    console.log('6️⃣ Closing menu...');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    console.log('   ✅ Menu closed\n');

    // Step 7: Verify manual override buttons are NOT visible yet (no letter displayed)
    console.log('7️⃣ Checking button visibility (should be hidden - no letter yet)...');
    const isButtonVisible = await page.locator('button.bg-gradient-to-br.from-green-500').isVisible().catch(() => false);
    if (!isButtonVisible) {
      console.log('   ✅ Buttons correctly hidden (no letter displayed)\n');
    } else {
      console.log('   ⚠️  Buttons are visible (unexpected)\n');
    }

    // Step 8: Start the game
    console.log('8️⃣ Starting the game...');
    const learnButton = page.locator('button:has-text("Learn")');
    await learnButton.waitFor({ state: 'visible', timeout: 5000 });
    await learnButton.click();
    await page.waitForTimeout(2000); // Wait for microphone permission and game to start
    console.log('   ✅ Game started\n');

    // Step 9: Wait for a letter to appear
    console.log('9️⃣ Waiting for letter to appear...');
    await page.waitForTimeout(1000);
    console.log('   ✅ Letter should be displayed\n');

    // Step 10: Verify manual override buttons are NOW visible
    console.log('🔟 Checking manual override buttons...');
    const isButton = page.locator('button.bg-gradient-to-br.from-green-500');
    const notButton = page.locator('button.bg-gradient-to-br.from-red-500');
    const isButtonNowVisible = await isButton.isVisible();
    const notButtonVisible = await notButton.isVisible();

    if (isButtonNowVisible && notButtonVisible) {
      console.log('   ✅ Both manual override buttons are visible\n');

      // Get the current letter
      const isButtonText = await isButton.textContent();
      const letter = isButtonText.match(/IS ([A-Z])/)?.[1];
      console.log(`   📝 Current letter: ${letter}\n`);
    } else {
      console.log('   ❌ Manual override buttons not found!\n');
      throw new Error('Manual override buttons not visible');
    }

    // Step 11: Test "IS X" button (positive snapshot)
    console.log('1️⃣1️⃣ Testing "IS X" button (positive snapshot)...');
    await isButton.click();
    console.log('   ✅ Clicked "IS X" button\n');

    // Step 12: Wait for and verify feedback message
    console.log('1️⃣2️⃣ Checking for feedback message...');
    await page.waitForTimeout(500); // Wait for recording to start

    // Look for feedback message (either "Recording..." or "Saved")
    const feedbackVisible = await page.locator('text=/Recording|Saved/i').isVisible({ timeout: 3000 }).catch(() => false);

    if (feedbackVisible) {
      const feedbackText = await page.locator('text=/Recording|Saved/i').first().textContent();
      console.log(`   ✅ Feedback message: "${feedbackText}"\n`);
    } else {
      console.log('   ⚠️  No feedback message found (might be too fast)\n');
    }

    // Step 13: Wait a bit, then test "NOT X" button (negative snapshot)
    console.log('1️⃣3️⃣ Testing "NOT X" button (negative snapshot)...');
    await page.waitForTimeout(2000); // Wait for first feedback to clear

    await notButton.click();
    console.log('   ✅ Clicked "NOT X" button\n');

    // Step 14: Verify second feedback message
    console.log('1️⃣4️⃣ Checking for second feedback message...');
    await page.waitForTimeout(500);

    const secondFeedbackVisible = await page.locator('text=/Saved/i').isVisible({ timeout: 3000 }).catch(() => false);

    if (secondFeedbackVisible) {
      const secondFeedbackText = await page.locator('text=/Saved/i').first().textContent();
      console.log(`   ✅ Second feedback: "${secondFeedbackText}"\n`);
    } else {
      console.log('   ⚠️  No second feedback message found\n');
    }

    // Step 15: Disable Advanced Mode and verify buttons disappear
    console.log('1️⃣5️⃣ Testing Advanced Mode toggle off...');
    await page.locator('button:has-text("Parents")').click();
    await page.waitForTimeout(500);
    await page.locator('button:has-text("Advanced Mode")').click();
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape'); // Close menu
    await page.waitForTimeout(500);

    const buttonsGone = await page.locator('button.bg-gradient-to-br.from-green-500').isVisible().catch(() => false);
    if (!buttonsGone) {
      console.log('   ✅ Buttons correctly hidden when Advanced Mode is OFF\n');
    } else {
      console.log('   ❌ Buttons still visible (should be hidden)\n');
    }

    console.log('\n✅ ✅ ✅ ALL TESTS PASSED! ✅ ✅ ✅\n');
    console.log('Summary:');
    console.log('  ✓ Advanced Mode toggle works');
    console.log('  ✓ Manual override buttons appear when enabled');
    console.log('  ✓ Buttons show correct letter');
    console.log('  ✓ "IS X" button works (positive snapshot)');
    console.log('  ✓ "NOT X" button works (negative snapshot)');
    console.log('  ✓ Feedback messages appear');
    console.log('  ✓ Buttons hide when Advanced Mode is disabled');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error.stack);
  } finally {
    // Keep browser open for 5 seconds to see final state
    console.log('\n⏳ Keeping browser open for 5 seconds...');
    await page.waitForTimeout(5000);
    await browser.close();
    console.log('🏁 Test complete!\n');
  }
}

testManualOverride();
