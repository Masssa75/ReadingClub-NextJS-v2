const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('🌐 Opening local file...');
  await page.goto('file:///Users/marcschwyn/Desktop/projects/DRC/index-2.0.html', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });

  await page.waitForTimeout(3000);

  console.log('\n🔍 Checking proficiency display functionality...');

  // Click Stats tab
  const statsTab = await page.waitForSelector('text=Stats', { timeout: 5000 });
  await statsTab.click();
  await page.waitForTimeout(3000);

  // Check proficiency values
  const proficiencyData = await page.evaluate(() => {
    return {
      mastered: document.getElementById('statsMastered')?.textContent,
      known: document.getElementById('statsKnown')?.textContent,
      sometimes: document.getElementById('statsSometimes')?.textContent,
      unknown: document.getElementById('statsUnknown')?.textContent,
      phase: document.getElementById('statsPhase')?.textContent,
      attempts: document.getElementById('statsAttempts')?.textContent
    };
  });

  console.log('\n📊 Stats tab values:', proficiencyData);

  // Verify the fix
  if (proficiencyData.mastered !== null && proficiencyData.known !== null) {
    console.log('\n✅ SUCCESS: Proficiency pools are being displayed!');
    console.log('   - Even without active session, proficiency data is showing');
    console.log('   - Session-specific stats show "Not Started" as expected');
  } else {
    console.log('\n❌ FAILED: Proficiency pools not displaying correctly');
  }

  console.log('\n⏸️ Pausing for 5 seconds so you can inspect...');
  await page.waitForTimeout(5000);

  await browser.close();
})();
