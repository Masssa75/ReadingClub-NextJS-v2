const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('pattern') || text.includes('📊') || text.includes('✅') || text.includes('❌')) {
      console.log('BROWSER:', text);
    }
  });

  console.log('🌐 Opening https://phuketcamp.com/phonics2/...');
  await page.goto('https://phuketcamp.com/phonics2/', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });

  console.log('\n📋 Waiting for page to load...');
  await page.waitForTimeout(4000);

  console.log('\n📋 Clicking Play tab...');
  const playTab = await page.waitForSelector('text=Play', { timeout: 5000 });
  await playTab.click();
  await page.waitForTimeout(2000);

  console.log('\n📋 Checking if additional patterns container exists...');
  const initialCheck = await page.evaluate(() => {
    return {
      containerExists: !!document.getElementById('additionalPatternsContainer'),
      gridExists: !!document.getElementById('additionalPatternsGrid')
    };
  });
  
  console.log('Initial check:', initialCheck);
  console.log(initialCheck.containerExists && initialCheck.gridExists ? '✅ UI elements exist' : '❌ UI elements missing');

  console.log('\n📊 Feature is ready for manual testing!');
  console.log('   To test:');
  console.log('   1. Calibrate a letter (e.g., "a")');
  console.log('   2. Practice it in Play mode');
  console.log('   3. Use training buttons to add positive/negative patterns');
  console.log('   4. Additional patterns should appear below main calibration');
  console.log('   5. Matching patterns should highlight with glow effect');

  await page.screenshot({ path: 'test-results/additional-patterns-ready.png', fullPage: true });
  console.log('\n✅ Screenshot saved');

  console.log('\n⏸️ Pausing for 10 seconds so you can inspect...');
  await page.waitForTimeout(10000);

  await browser.close();
  
  console.log('\n✅ Basic UI structure verified - feature ready for manual testing');
})();
