const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Capture console messages
  const consoleMessages = [];
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error' || type === 'warning') {
      consoleMessages.push({ type, text });
      console.log(`[${type.toUpperCase()}] ${text}`);
    }
  });

  // Capture page errors
  page.on('pageerror', error => {
    console.log(`[PAGE ERROR] ${error.message}`);
    consoleMessages.push({ type: 'pageerror', text: error.message });
  });

  console.log('🔍 Loading http://localhost:3001/play...\n');

  try {
    await page.goto('http://localhost:3001/play', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait a bit for any async errors
    await page.waitForTimeout(3000);

    console.log('\n📊 Summary:');
    if (consoleMessages.length === 0) {
      console.log('✅ No errors or warnings found!');
    } else {
      console.log(`❌ Found ${consoleMessages.length} issues:`);
      consoleMessages.forEach((msg, i) => {
        console.log(`\n${i + 1}. [${msg.type.toUpperCase()}]`);
        console.log(`   ${msg.text}`);
      });
    }
  } catch (error) {
    console.log(`\n❌ Failed to load page: ${error.message}`);
  }

  await browser.close();
})();
