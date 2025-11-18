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

  console.log('🌐 Opening local file...');
  await page.goto('file:///Users/marcschwyn/Desktop/projects/DRC/index-2.0.html', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });

  // Wait for profile to be created
  console.log('\n📋 Step 1: Waiting for profile initialization...');
  await page.waitForFunction(() => window.currentProfileId !== undefined, { timeout: 10000 });
  
  const profileId = await page.evaluate(() => window.currentProfileId);
  console.log('Profile ID:', profileId);

  console.log('\n📋 Step 2: Setting up test data with correct profile ID...');
  await page.evaluate(() => {
    // Add calibration for letter 'a'
    window.calibrationData = window.calibrationData || {};
    window.calibrationData['a'] = {
      patterns: [Array(64).fill(0).map(() => Math.random())],
      negativePatterns: [],
      timestamp: Date.now()
    };

    // Add additional patterns to localStorage with CURRENT profileId
    const profileId = window.currentProfileId;
    const letter = 'a';
    const key = 'calibration_extras_' + profileId + '_' + letter;
    
    const mockExtras = {
      patterns: [
        Array(64).fill(0).map(() => Math.random()),
        Array(64).fill(0).map(() => Math.random())
      ],
      negativePatterns: [
        Array(64).fill(0).map(() => Math.random())
      ]
    };
    
    localStorage.setItem(key, JSON.stringify(mockExtras));
    
    return { profileId, key };
  });

  console.log('\n📋 Step 3: Clicking Play tab...');
  const playTab = await page.waitForSelector('text=Play', { timeout: 5000 });
  await playTab.click();
  await page.waitForTimeout(1000);

  console.log('\n📋 Step 4: Calling visualizeStoredPattern...');
  await page.evaluate(() => {
    window.visualizeStoredPattern('a');
  });

  await page.waitForTimeout(2000);

  console.log('\n📋 Step 5: Checking results...');
  const result = await page.evaluate(() => {
    const container = document.getElementById('additionalPatternsContainer');
    const grid = document.getElementById('additionalPatternsGrid');
    
    return {
      containerVisible: container ? container.style.display !== 'none' : false,
      cardCount: grid ? grid.children.length : 0,
      cards: grid ? Array.from(grid.children).map(card => ({
        id: card.id,
        label: card.querySelector('div').textContent
      })) : []
    };
  });

  console.log('\n📊 RESULTS:');
  console.log('  Container visible:', result.containerVisible ? '✅ YES' : '❌ NO');
  console.log('  Card count:', result.cardCount, '(expected: 3)');
  
  if (result.cards.length > 0) {
    console.log('\n  Cards created:');
    result.cards.forEach((card, i) => {
      console.log('    ' + (i + 1) + '. ' + card.id + ' - ' + card.label);
    });
  }

  await page.screenshot({ path: 'test-results/additional-patterns-working.png', fullPage: true });
  console.log('\n✅ Screenshot saved');

  const passed = result.containerVisible && result.cardCount === 3;
  console.log('\n' + '='.repeat(70));
  console.log(passed ? '✅ TEST PASSED!' : '❌ TEST FAILED');
  console.log('='.repeat(70));

  console.log('\n⏸️ Pausing for 5 seconds...');
  await page.waitForTimeout(5000);

  await browser.close();
  process.exit(passed ? 0 : 1);
})();
