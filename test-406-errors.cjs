const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Track all network requests
  const proficiencyRequests = [];
  const errors = [];

  page.on('response', async response => {
    if (response.url().includes('proficiency')) {
      proficiencyRequests.push({
        url: response.url(),
        status: response.status(),
        statusText: response.statusText()
      });

      if (response.status() === 406) {
        console.log('❌ 406 Error:', response.url());
        try {
          const body = await response.json();
          console.log('   Response:', JSON.stringify(body, null, 2));
        } catch (e) {
          console.log('   Could not parse response body');
        }
      }
    }
  });

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Error') || text.includes('error') || text.includes('❌')) {
      console.log('Console Error:', text);
      errors.push(text);
    }
  });

  console.log('🌐 Opening phuketcamp.com/phonics2/...');
  await page.goto('https://phuketcamp.com/phonics2/', { waitUntil: 'domcontentloaded' });

  console.log('\n📝 Waiting for page to load and checking for errors...');
  await page.waitForTimeout(3000);

  // Try to click Play tab
  try {
    console.log('\n▶️ Looking for Play tab...');
    const playTab = await page.waitForSelector('text=Play', { timeout: 5000 });
    if (playTab) {
      await playTab.click();
      console.log('   Clicked Play tab');
      await page.waitForTimeout(3000);
    }
  } catch (e) {
    console.log('   Could not find/click Play tab:', e.message);
    console.log('   Continuing anyway to check for errors...');
  }

  await page.waitForTimeout(2000);

  console.log('\n\n📊 RESULTS:');
  console.log('='.repeat(60));
  console.log(`Total proficiency requests: ${proficiencyRequests.length}`);

  const failedRequests = proficiencyRequests.filter(r => r.status === 406);
  console.log(`Failed (406) requests: ${failedRequests.length}`);

  if (failedRequests.length > 0) {
    console.log('\n❌ ISSUE CONFIRMED: 406 errors detected!');
    console.log('\nSample failed request:');
    console.log(JSON.stringify(failedRequests[0], null, 2));
  } else {
    console.log('\n✅ No 406 errors found!');
  }

  console.log('\nConsole errors found:', errors.length);
  if (errors.length > 0) {
    console.log('First few errors:');
    errors.slice(0, 3).forEach(e => console.log('  -', e));
  }

  console.log('\n⏸️ Pausing for 10 seconds so you can inspect...');
  await page.waitForTimeout(10000);

  await browser.close();
})();
