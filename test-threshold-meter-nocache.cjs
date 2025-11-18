const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('threshold') || text.includes('Analyzer') || text.includes('💓')) {
      console.log('BROWSER:', text);
    }
  });

  console.log('🌐 Opening production site (no cache)...');
  // Add cache buster
  const timestamp = Date.now();
  await page.goto(`https://phuketcamp.com/phonics2/?v=${timestamp}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });

  await page.waitForTimeout(3000);

  console.log('\n📋 Clicking Play tab...');
  const playTab = await page.waitForSelector('text=Play', { timeout: 5000 });
  await playTab.click();
  await page.waitForTimeout(2000);

  console.log('\n📋 Checking if threshold meter exists in HTML...');
  const meterExists = await page.evaluate(() => {
    return {
      meterContainer: !!document.getElementById('thresholdMeter'),
      volumeMeterFill: !!document.getElementById('volumeMeterFill'),
      concentrationMeterFill: !!document.getElementById('concentrationMeterFill'),
      volumeMeterValue: !!document.getElementById('volumeMeterValue'),
      concentrationMeterValue: !!document.getElementById('concentrationMeterValue')
    };
  });

  console.log('Meter elements:', meterExists);

  if (!meterExists.meterContainer) {
    console.log('❌ Threshold meter not found - may need more time for deployment');
    console.log('   Netlify auto-deploys from GitHub, usually takes 1-2 minutes');
    console.log('   Try running this test again in a minute or check Netlify dashboard');
    await browser.close();
    return;
  }

  console.log('✅ Threshold meter deployed successfully!');

  console.log('\n📋 Starting game to show threshold meter...');
  const startBtn = await page.waitForSelector('text=▶ Start Game', { timeout: 5000 });
  await startBtn.click();
  await page.waitForTimeout(2000);

  const meterVisible = await page.evaluate(() => {
    const meter = document.getElementById('thresholdMeter');
    return {
      exists: !!meter,
      display: meter ? meter.style.display : null,
      isVisible: meter ? meter.style.display !== 'none' : false
    };
  });

  console.log('Meter visibility:', meterVisible);

  if (meterVisible.isVisible) {
    console.log('✅ Threshold meter is visible!');

    await page.waitForTimeout(3000);

    const meterValues = await page.evaluate(() => {
      return {
        volumeValue: document.getElementById('volumeMeterValue')?.textContent,
        volumeThreshold: document.getElementById('volumeMeterThreshold')?.textContent,
        concentrationValue: document.getElementById('concentrationMeterValue')?.textContent,
        concentrationThreshold: document.getElementById('concentrationMeterThreshold')?.textContent
      };
    });

    console.log('\n📊 Meter values:', meterValues);
    console.log('\n🎉 DEPLOYMENT SUCCESSFUL!');
    console.log('   The threshold meter is live at https://phuketcamp.com/phonics2/');
  } else {
    console.log('⚠️ Meter exists but not visible (may need calibrations)');
  }

  await page.screenshot({ path: 'test-results/threshold-meter-production.png', fullPage: true });
  console.log('\n📸 Screenshot saved');

  console.log('\n⏸️ Pausing for 10 seconds...');
  await page.waitForTimeout(10000);

  await browser.close();
})();
