const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Listen to console messages
  page.on('console', msg => console.log('BROWSER:', msg.text()));

  console.log('🌐 Opening local file...');
  await page.goto('file:///Users/marcschwyn/Desktop/projects/DRC/index-2.0.html', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });

  await page.waitForTimeout(3000);

  console.log('\n📋 Setting up test data...');
  const setupResult = await page.evaluate(() => {
    // Mock calibration
    window.calibrationData = window.calibrationData || {};
    window.calibrationData['a'] = {
      patterns: [Array(64).fill(0).map(() => Math.random())],
      negativePatterns: [],
      timestamp: Date.now()
    };

    // Add extras to localStorage
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
    
    // Verify it was saved
    const saved = localStorage.getItem(key);
    
    return {
      profileId,
      key,
      saved: !!saved,
      savedLength: saved ? saved.length : 0
    };
  });

  console.log('Setup result:', setupResult);

  console.log('\n📋 Calling visualizeAdditionalPatterns with debug...');
  const debugResult = await page.evaluate(() => {
    const container = document.getElementById('additionalPatternsContainer');
    const grid = document.getElementById('additionalPatternsGrid');
    const profileId = window.currentProfileId;
    const letter = 'a';
    const extrasKey = 'calibration_extras_' + profileId + '_' + letter;
    const extrasJSON = localStorage.getItem(extrasKey);
    
    console.log('Debug info:');
    console.log('- profileId:', profileId);
    console.log('- extrasKey:', extrasKey);
    console.log('- extrasJSON exists:', !!extrasJSON);
    console.log('- container exists:', !!container);
    console.log('- grid exists:', !!grid);
    
    if (extrasJSON) {
      const extras = JSON.parse(extrasJSON);
      console.log('- positive patterns:', extras.patterns ? extras.patterns.length : 0);
      console.log('- negative patterns:', extras.negativePatterns ? extras.negativePatterns.length : 0);
    }
    
    // Manually call the function
    if (typeof window.visualizeAdditionalPatterns === 'function') {
      console.log('Calling visualizeAdditionalPatterns...');
      window.visualizeAdditionalPatterns(letter);
    } else {
      console.log('ERROR: visualizeAdditionalPatterns not found!');
    }
    
    return {
      functionExists: typeof window.visualizeAdditionalPatterns === 'function',
      containerDisplay: container ? container.style.display : null,
      gridChildCount: grid ? grid.children.length : 0
    };
  });

  await page.waitForTimeout(2000);

  console.log('\nDebug result:', debugResult);

  console.log('\n⏸️ Pausing for 8 seconds so you can inspect...');
  await page.waitForTimeout(8000);

  await browser.close();
})();
