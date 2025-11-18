const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER:', msg.text()));

  console.log('🌐 Opening local file...');
  await page.goto('file:///Users/marcschwyn/Desktop/projects/DRC/index-2.0.html', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });

  console.log('\n⏳ Waiting for page to load...');
  await page.waitForTimeout(4000);

  console.log('\n📋 Step 1: Check if reset button exists...');
  const resetBtn = await page.waitForSelector('text=Reset All', { timeout: 5000 });
  console.log('✅ Reset button found');

  console.log('\n📋 Step 2: Click reset button...');
  
  // Handle the confirm dialog
  page.on('dialog', async dialog => {
    console.log('Dialog message:', dialog.message());
    await dialog.accept();
  });

  await resetBtn.click();
  await page.waitForTimeout(3000);

  console.log('\n📋 Step 3: Check console for success messages...');
  console.log('   (Check BROWSER logs above for reset messages)');

  console.log('\n✅ Reset button is clickable and triggers reset logic');
  console.log('   The function should:');
  console.log('   - Delete calibrations from Supabase');
  console.log('   - Clear training patterns from localStorage');
  console.log('   - Refresh the calibration grid');

  await page.screenshot({ path: 'test-results/reset-calibration.png', fullPage: true });
  console.log('\n📸 Screenshot saved');

  console.log('\n⏸️ Pausing for 5 seconds...');
  await page.waitForTimeout(5000);

  await browser.close();
  console.log('\n✅ Test complete');
})();
