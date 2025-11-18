const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Track all 406 errors
  const errors406 = [];
  const proficiencyRequests = [];
  const consoleErrors = [];

  page.on('response', async response => {
    const url = response.url();

    // Track proficiency-related requests
    if (url.includes('proficiency') || url.includes('calibrations')) {
      proficiencyRequests.push({
        url: url,
        status: response.status(),
        method: response.request().method()
      });

      if (response.status() === 406) {
        errors406.push({
          url: url,
          status: response.status(),
          statusText: response.statusText()
        });
        console.log('❌ 406 Error detected:', url);
      }
    }
  });

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Error') || text.includes('406')) {
      consoleErrors.push(text);
    }
  });

  console.log('🌐 Opening https://phuketcamp.com/phonics2/...');
  await page.goto('https://phuketcamp.com/phonics2/', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });

  console.log('⏳ Waiting for page to fully load...');
  await page.waitForTimeout(3000);

  console.log('▶️ Clicking Play tab...');
  try {
    const playTab = await page.waitForSelector('text=Play', { timeout: 5000 });
    await playTab.click();
    console.log('✓ Clicked Play tab');
    await page.waitForTimeout(4000);
  } catch (e) {
    console.log('⚠️ Could not click Play tab:', e.message);
  }

  console.log('⏳ Monitoring for 3 more seconds...');
  await page.waitForTimeout(3000);

  console.log('\n' + '='.repeat(70));
  console.log('📊 VERIFICATION RESULTS');
  console.log('='.repeat(70));

  console.log(`\nTotal proficiency/calibration requests: ${proficiencyRequests.length}`);
  console.log(`Total 406 errors: ${errors406.length}`);

  if (errors406.length > 0) {
    console.log('\n❌ FAILED: 406 errors still present!');
    console.log('\nFailed requests:');
    errors406.forEach((err, i) => {
      console.log(`  ${i + 1}. ${err.url}`);
      console.log(`     Status: ${err.status} ${err.statusText}`);
    });
  } else {
    console.log('\n✅ SUCCESS: No 406 errors detected!');
  }

  if (proficiencyRequests.length > 0) {
    console.log('\nProficiency request summary:');
    const statusCounts = {};
    proficiencyRequests.forEach(req => {
      statusCounts[req.status] = (statusCounts[req.status] || 0) + 1;
    });
    Object.entries(statusCounts).forEach(([status, count]) => {
      const icon = status === '200' ? '✓' : status === '406' ? '✗' : '•';
      console.log(`  ${icon} ${status}: ${count} requests`);
    });
  }

  if (consoleErrors.length > 0) {
    console.log('\n⚠️ Console errors found:', consoleErrors.length);
    consoleErrors.slice(0, 3).forEach(err => console.log(`  - ${err}`));
  }

  console.log('\n⏸️ Pausing for 5 seconds so you can inspect...');
  await page.waitForTimeout(5000);

  await browser.close();

  // Exit with appropriate code
  process.exit(errors406.length > 0 ? 1 : 0);
})();
