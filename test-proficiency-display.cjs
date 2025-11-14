const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('🌐 Opening https://phuketcamp.com/phonics2/...');
  await page.goto('https://phuketcamp.com/phonics2/', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });

  await page.waitForTimeout(2000);

  // Check for Letters in Practice tracker
  console.log('\n🔍 Checking for "Letters in Practice" tracker...');
  const trackerVisible = await page.evaluate(() => {
    const tracker = document.getElementById('letterProgressTracker');
    if (!tracker) return { exists: false };
    
    const computedStyle = window.getComputedStyle(tracker);
    return {
      exists: true,
      display: computedStyle.display,
      visible: computedStyle.display !== 'none',
      html: tracker.innerHTML.substring(0, 200)
    };
  });
  
  console.log('Tracker status:', trackerVisible);

  // Check Stats tab
  console.log('\n🔍 Clicking Stats tab to check proficiency display...');
  try {
    const statsTab = await page.waitForSelector('text=Stats', { timeout: 5000 });
    await statsTab.click();
    await page.waitForTimeout(2000);
    
    const statsDisplay = await page.evaluate(() => {
      return {
        mastered: document.getElementById('statsMastered')?.textContent,
        known: document.getElementById('statsKnown')?.textContent,
        sometimes: document.getElementById('statsSometimes')?.textContent,
        unknown: document.getElementById('statsUnknown')?.textContent
      };
    });
    
    console.log('Stats display values:', statsDisplay);
  } catch (e) {
    console.log('⚠️ Could not check Stats tab:', e.message);
  }

  // Check Play tab
  console.log('\n🔍 Checking Play tab...');
  try {
    const playTab = await page.waitForSelector('text=Play', { timeout: 5000 });
    await playTab.click();
    await page.waitForTimeout(2000);
    
    const playTabState = await page.evaluate(() => {
      const tracker = document.getElementById('letterProgressTracker');
      const computedStyle = window.getComputedStyle(tracker);
      
      return {
        trackerDisplay: computedStyle.display,
        trackerVisible: computedStyle.display !== 'none',
        hasCards: document.getElementById('letterProgressCards')?.children.length || 0
      };
    });
    
    console.log('Play tab tracker state:', playTabState);
  } catch (e) {
    console.log('⚠️ Could not check Play tab:', e.message);
  }

  console.log('\n⏸️ Pausing for 5 seconds so you can inspect...');
  await page.waitForTimeout(5000);

  await browser.close();
})();
