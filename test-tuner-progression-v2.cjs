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
    console.log('BROWSER:', text);
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
  await page.waitForTimeout(3000);

  // Wait for game to start and target letter to be set
  console.log('\n⏳ Waiting for target letter to be displayed...');
  await page.waitForSelector('#tunerLetter', { timeout: 5000 });
  await page.waitForTimeout(1000);

  // Get initial state
  const initialState = await page.evaluate(() => {
    const letterElem = document.getElementById('tunerLetter');
    return {
      targetLetter: window.targetLetter,
      displayedLetter: letterElem ? letterElem.textContent : null,
      isRunning: window.isRunning,
      currentSession: window.currentSession ? 'exists' : null,
      currentStreak: window.currentStreak
    };
  });
  console.log('\n📊 Initial state:', initialState);

  console.log('\n🎤 Waiting for real voice detection (say the letter)...');
  console.log(`   Target: ${initialState.targetLetter || initialState.displayedLetter}`);

  // Wait for a successful match to be recorded
  let attemptRecorded = false;
  let timeout = 30000; // 30 seconds
  let elapsed = 0;

  while (!attemptRecorded && elapsed < timeout) {
    await page.waitForTimeout(1000);
    elapsed += 1000;

    // Check if an attempt was recorded
    const recorded = logs.some(log => log.includes('📝 Recorded attempt'));
    if (recorded) {
      attemptRecorded = true;
      console.log('✅ Attempt recorded!');
      break;
    }
  }

  if (!attemptRecorded) {
    console.log('❌ No attempt recorded within 30 seconds');
  }

  await page.waitForTimeout(2000);

  // Check final state
  const finalState = await page.evaluate(() => {
    const letterElem = document.getElementById('tunerLetter');
    return {
      targetLetter: window.targetLetter,
      displayedLetter: letterElem ? letterElem.textContent : null,
      currentStreak: window.currentStreak
    };
  });
  console.log('\n📊 Final state:', finalState);

  if (finalState.targetLetter === initialState.targetLetter) {
    console.log('\n❌ ISSUE CONFIRMED: Target letter did not change after successful match!');
    console.log(`   Initial: ${initialState.targetLetter}`);
    console.log(`   Final: ${finalState.targetLetter}`);
  } else {
    console.log('\n✅ SUCCESS: Target letter changed');
    console.log(`   Initial: ${initialState.targetLetter}`);
    console.log(`   Final: ${finalState.targetLetter}`);
  }

  console.log('\n⏸️ Pausing for 10 seconds for inspection...');
  await page.waitForTimeout(10000);

  await browser.close();
})();
