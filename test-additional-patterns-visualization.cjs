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

  await page.waitForTimeout(2000);

  console.log('\n📋 Step 1: Clicking Play tab...');
  const playTab = await page.waitForSelector('text=Play', { timeout: 5000 });
  await playTab.click();
  await page.waitForTimeout(2000);

  console.log('📋 Step 2: Checking initial state (no additional patterns yet)...');
  const initialState = await page.evaluate(() => {
    const container = document.getElementById('additionalPatternsContainer');
    return {
      exists: !!container,
      visible: container ? container.style.display !== 'none' : false,
      innerHTML: container ? container.innerHTML.substring(0, 100) : null
    };
  });
  
  console.log('Initial additional patterns container:', initialState);
  console.log(initialState.visible ? '⚠️ Container visible (should be hidden)' : '✅ Container hidden as expected');

  console.log('\n📋 Step 3: Simulating adding training patterns via localStorage...');
  await page.evaluate(() => {
    // Get current profile ID (should be guest profile)
    const profileId = window.currentProfileId;
    const letter = 'a';
    
    // Create mock additional patterns
    const mockExtras = {
      patterns: [
        // Additional positive pattern #1
        Array(64).fill(0).map((_, i) => Math.random() * 0.8 + 0.2),
        // Additional positive pattern #2
        Array(64).fill(0).map((_, i) => Math.random() * 0.6 + 0.3)
      ],
      negativePatterns: [
        // Negative pattern #1
        Array(64).fill(0).map((_, i) => Math.random() * 0.5 + 0.1)
      ]
    };
    
    const key = `calibration_extras_${profileId}_${letter}`;
    localStorage.setItem(key, JSON.stringify(mockExtras));
    
    console.log(`💾 Saved mock patterns for ${letter}:`, mockExtras);
    
    // Manually trigger visualization (simulate letter switch)
    if (typeof window.visualizeAdditionalPatterns === 'function') {
      window.visualizeAdditionalPatterns(letter);
    }
    
    return { profileId, letter, key };
  });

  await page.waitForTimeout(1000);

  console.log('\n📋 Step 4: Checking if additional patterns are now visible...');
  const afterAddState = await page.evaluate(() => {
    const container = document.getElementById('additionalPatternsContainer');
    const grid = document.getElementById('additionalPatternsGrid');
    
    return {
      containerVisible: container ? container.style.display !== 'none' : false,
      cardCount: grid ? grid.children.length : 0,
      cards: grid ? Array.from(grid.children).map((card, i) => ({
        id: card.id,
        text: card.textContent.substring(0, 30),
        backgroundColor: window.getComputedStyle(card).backgroundColor,
        borderColor: window.getComputedStyle(card).borderColor
      })) : []
    };
  });

  console.log('\n📊 Additional Patterns State:');
  console.log(`  Container visible: ${afterAddState.containerVisible ? '✅ YES' : '❌ NO'}`);
  console.log(`  Total cards: ${afterAddState.cardCount}`);
  console.log(`  Expected: 3 cards (2 positive + 1 negative)`);
  
  if (afterAddState.cards.length > 0) {
    console.log('\n  Card details:');
    afterAddState.cards.forEach((card, i) => {
      console.log(`    ${i + 1}. ${card.id}`);
      console.log(`       Label: ${card.text}`);
      console.log(`       Border: ${card.borderColor}`);
    });
  }

  console.log('\n📋 Step 5: Testing pattern highlighting...');
  const highlightResult = await page.evaluate(() => {
    // Test highlighting function
    if (typeof window.highlightMatchedPattern === 'function') {
      // Highlight positive pattern #1 (index 0)
      window.highlightMatchedPattern('positive', 0);
      
      const card = document.getElementById('pattern-positive-0');
      if (card) {
        const style = window.getComputedStyle(card);
        return {
          success: true,
          border: style.border,
          boxShadow: style.boxShadow,
          transform: style.transform
        };
      }
    }
    return { success: false };
  });

  if (highlightResult.success) {
    console.log('✅ Pattern highlighting works!');
    console.log(`   Border: ${highlightResult.border}`);
    console.log(`   Box shadow: ${highlightResult.boxShadow.substring(0, 50)}...`);
    console.log(`   Transform: ${highlightResult.transform}`);
  } else {
    console.log('❌ Pattern highlighting failed');
  }

  console.log('\n📋 Step 6: Taking screenshot...');
  await page.screenshot({ path: 'test-results/additional-patterns-visualization.png', fullPage: true });
  console.log('✅ Screenshot saved to test-results/additional-patterns-visualization.png');

  console.log('\n' + '='.repeat(70));
  console.log('📊 FINAL VERIFICATION RESULTS');
  console.log('='.repeat(70));

  const allChecks = [
    { name: 'Container exists', pass: initialState.exists },
    { name: 'Initially hidden (no patterns)', pass: !initialState.visible },
    { name: 'Visible after adding patterns', pass: afterAddState.containerVisible },
    { name: 'Correct card count (3)', pass: afterAddState.cardCount === 3 },
    { name: 'Highlighting works', pass: highlightResult.success }
  ];

  allChecks.forEach(check => {
    console.log(`${check.pass ? '✅' : '❌'} ${check.name}`);
  });

  const allPassed = allChecks.every(c => c.pass);
  console.log('\n' + (allPassed ? '✅ ALL TESTS PASSED!' : '❌ SOME TESTS FAILED'));

  console.log('\n⏸️ Pausing for 5 seconds so you can inspect...');
  await page.waitForTimeout(5000);

  await browser.close();
  
  process.exit(allPassed ? 0 : 1);
})();
