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

  console.log('\n📋 Step 1: Setting up a calibration for letter "a"...');
  await page.evaluate(() => {
    window.calibrationData = window.calibrationData || {};
    window.calibrationData['a'] = {
      patterns: [Array(64).fill(0).map(() => Math.random())],
      negativePatterns: [],
      timestamp: Date.now(),
      audioUrl: null
    };
  });

  console.log('📋 Step 2: Adding additional training patterns to localStorage...');
  await page.evaluate(() => {
    const profileId = window.currentProfileId;
    const letter = 'a';
    
    const mockExtras = {
      patterns: [
        Array(64).fill(0).map(() => Math.random() * 0.8),
        Array(64).fill(0).map(() => Math.random() * 0.6)
      ],
      negativePatterns: [
        Array(64).fill(0).map(() => Math.random() * 0.5)
      ]
    };
    
    const key = 'calibration_extras_' + profileId + '_' + letter;
    localStorage.setItem(key, JSON.stringify(mockExtras));
    
    return { profileId, key };
  });

  console.log('\n📋 Step 3: Clicking Play tab...');
  const playTab = await page.waitForSelector('text=Play', { timeout: 5000 });
  await playTab.click();
  await page.waitForTimeout(2000);

  console.log('📋 Step 4: Manually calling visualizeStoredPattern for letter "a"...');
  await page.evaluate(() => {
    if (typeof window.visualizeStoredPattern === 'function') {
      window.visualizeStoredPattern('a');
    }
  });

  await page.waitForTimeout(2000);

  console.log('\n📋 Step 5: Checking if additional patterns container is visible...');
  const containerState = await page.evaluate(() => {
    const container = document.getElementById('additionalPatternsContainer');
    const grid = document.getElementById('additionalPatternsGrid');
    
    return {
      containerExists: !!container,
      containerDisplay: container ? container.style.display : null,
      containerVisible: container ? container.style.display !== 'none' : false,
      gridExists: !!grid,
      cardCount: grid ? grid.children.length : 0
    };
  });

  console.log('\n📊 Container State:');
  console.log('  Container exists:', containerState.containerExists);
  console.log('  Container display:', containerState.containerDisplay);
  console.log('  Container visible:', containerState.containerVisible);
  console.log('  Card count:', containerState.cardCount, '(expected: 3)');

  const passed = containerState.containerVisible && containerState.cardCount === 3;

  if (containerState.cardCount > 0) {
    const cardDetails = await page.evaluate(() => {
      const grid = document.getElementById('additionalPatternsGrid');
      return Array.from(grid.children).map(card => ({
        id: card.id,
        text: card.textContent.substring(0, 50)
      }));
    });
    
    console.log('\n  Cards:');
    cardDetails.forEach((card, i) => {
      console.log('    ' + (i + 1) + '. ' + card.id + ' - ' + card.text);
    });
  }

  console.log('\n📋 Step 6: Taking screenshot...');
  await page.screenshot({ path: 'test-results/additional-patterns-v2.png', fullPage: true });

  console.log('\n======================================================================');
  console.log(passed ? '✅ TEST PASSED' : '❌ TEST FAILED');
  console.log('======================================================================');

  console.log('\n⏸️ Pausing for 5 seconds...');
  await page.waitForTimeout(5000);

  await browser.close();
  process.exit(passed ? 0 : 1);
})();
