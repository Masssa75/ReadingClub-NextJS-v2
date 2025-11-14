const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Collect console logs
  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);
    if (text.includes('📝 Recorded attempt') || text.includes('ACCEPTED') || text.includes('REJECTED') || text.includes('Warmup') || text.includes('target:')) {
      console.log('BROWSER:', text);
    }
  });

  console.log('🌐 Opening production site...');
  await page.goto('https://phuketcamp.com/phonics2/', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });

  await page.waitForTimeout(3000);

  console.log('\n📋 Clicking Play tab...');
  const playTab = await page.waitForSelector('text=Play', { timeout: 5000 });
  await playTab.click();
  await page.waitForTimeout(2000);

  // Get initial target letter
  const initialTarget = await page.evaluate(() => {
    return document.getElementById('tunerLetter')?.textContent;
  });
  console.log(`\n🎯 Initial target letter: ${initialTarget}`);

  console.log('\n📋 Simulating successful voice match...');

  // Simulate a successful match by directly calling the recordAttempt function
  const result = await page.evaluate(() => {
    // Check if there's a target letter
    if (!window.targetLetter) {
      return { error: 'No target letter set' };
    }

    const target = window.targetLetter;

    // Manually trigger a successful match
    if (typeof window.recordAttempt === 'function') {
      window.recordAttempt(target, true);
      return {
        success: true,
        target: target,
        streak: window.currentStreak
      };
    }

    return { error: 'recordAttempt function not found' };
  });

  console.log('Result after simulated match:', result);

  await page.waitForTimeout(2000);

  // Check if letter changed
  const newTarget = await page.evaluate(() => {
    return document.getElementById('tunerLetter')?.textContent;
  });
  console.log(`\n🎯 Target letter after match: ${newTarget}`);

  if (newTarget === initialTarget) {
    console.log('❌ ISSUE: Letter did not change after successful match!');
  } else {
    console.log('✅ SUCCESS: Letter changed after match');
  }

  // Check for relevant console logs
  console.log('\n📊 Checking for "Recorded attempt" logs...');
  const recordedLogs = logs.filter(log => log.includes('📝 Recorded attempt'));
  console.log(`Found ${recordedLogs.length} recorded attempt logs`);
  recordedLogs.forEach(log => console.log('  -', log));

  console.log('\n⏸️ Pausing for 10 seconds for manual inspection...');
  await page.waitForTimeout(10000);

  await browser.close();
})();
