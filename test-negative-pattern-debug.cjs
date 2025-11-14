const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER:', msg.text()));

  console.log('🌐 Opening production site...');
  await page.goto('https://phuketcamp.com/phonics2/', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });

  await page.waitForTimeout(3000);

  console.log('\n📋 Checking if negative patterns are being saved and visualized...');

  // Check localStorage for calibration extras
  const extrasData = await page.evaluate(() => {
    const results = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.includes('calibration_extras_')) {
        const value = localStorage.getItem(key);
        results[key] = JSON.parse(value);
      }
    }
    return results;
  });

  console.log('\n📊 Current calibration extras in localStorage:');
  Object.keys(extrasData).forEach(key => {
    const letter = key.split('_').pop();
    const data = extrasData[key];
    console.log(`  ${letter}: ${data.patterns?.length || 0} positive, ${data.negativePatterns?.length || 0} negative`);
  });

  // Check if additional patterns container exists and is visible
  const containerStatus = await page.evaluate(() => {
    const container = document.getElementById('additionalPatternsContainer');
    const grid = document.getElementById('additionalPatternsGrid');
    return {
      containerExists: !!container,
      gridExists: !!grid,
      containerDisplay: container ? container.style.display : null,
      gridChildCount: grid ? grid.children.length : 0
    };
  });

  console.log('\n📊 Additional patterns container status:', containerStatus);

  console.log('\n⏸️ Pausing for 10 seconds for inspection...');
  await page.waitForTimeout(10000);

  await browser.close();
})();
