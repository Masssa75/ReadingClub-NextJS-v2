const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  const errors = [];
  const warnings = [];

  // Capture all console messages
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    const location = msg.location();

    if (type === 'error') {
      errors.push({ text, location });
      console.log(`\n❌ CONSOLE ERROR:`);
      console.log(`   ${text}`);
      if (location.url) {
        console.log(`   at ${location.url}:${location.lineNumber}`);
      }
    } else if (type === 'warning') {
      warnings.push({ text, location });
      console.log(`\n⚠️  WARNING:`);
      console.log(`   ${text}`);
    }
  });

  // Capture page errors (uncaught exceptions)
  page.on('pageerror', error => {
    errors.push({ text: error.message, stack: error.stack });
    console.log(`\n❌ PAGE ERROR (Uncaught Exception):`);
    console.log(`   ${error.message}`);
    if (error.stack) {
      console.log(`\n   Stack trace:`);
      console.log(error.stack.split('\n').map(line => `   ${line}`).join('\n'));
    }
  });

  // Capture failed requests
  page.on('requestfailed', request => {
    const failure = request.failure();
    console.log(`\n❌ REQUEST FAILED:`);
    console.log(`   ${request.method()} ${request.url()}`);
    console.log(`   ${failure?.errorText || 'Unknown error'}`);
  });

  console.log('🔍 Testing /play page...\n');

  try {
    await page.goto('http://localhost:3001/play', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait for any delayed errors
    await page.waitForTimeout(5000);

    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    console.log(`Errors: ${errors.length}`);
    console.log(`Warnings: ${warnings.length}`);

    if (errors.length === 0 && warnings.length === 0) {
      console.log('\n✅ No errors or warnings found!');
    }

  } catch (error) {
    console.log(`\n❌ Failed to load page: ${error.message}`);
  }

  // Also test /calibrate page
  console.log('\n\n🔍 Testing /calibrate page...\n');
  errors.length = 0;
  warnings.length = 0;

  try {
    await page.goto('http://localhost:3001/calibrate', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    await page.waitForTimeout(5000);

    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    console.log(`Errors: ${errors.length}`);
    console.log(`Warnings: ${warnings.length}`);

    if (errors.length === 0 && warnings.length === 0) {
      console.log('\n✅ No errors or warnings found!');
    }

  } catch (error) {
    console.log(`\n❌ Failed to load page: ${error.message}`);
  }

  await browser.close();
})();
