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

  console.log('🌐 Opening production site...');
  await page.goto('https://phuketcamp.com/phonics2/', {
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
    console.log('❌ Threshold meter not found - feature not deployed yet');
    await browser.close();
    return;
  }

  console.log('\n📋 Starting game to show threshold meter...');
  const startBtn = await page.waitForSelector('text=▶ Start Game', { timeout: 5000 });
  await startBtn.click();
  await page.waitForTimeout(2000);

  console.log('\n📋 Checking if threshold meter is visible...');
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

    // Wait a few seconds to see if values update
    await page.waitForTimeout(3000);

    const meterValues = await page.evaluate(() => {
      return {
        volumeValue: document.getElementById('volumeMeterValue')?.textContent,
        volumeThreshold: document.getElementById('volumeMeterThreshold')?.textContent,
        concentrationValue: document.getElementById('concentrationMeterValue')?.textContent,
        concentrationThreshold: document.getElementById('concentrationMeterThreshold')?.textContent,
        volumeFillWidth: document.getElementById('volumeMeterFill')?.style.width,
        concentrationFillWidth: document.getElementById('concentrationMeterFill')?.style.width
      };
    });

    console.log('\n📊 Meter values:', meterValues);
    console.log('\n✅ Threshold meter is working!');
    console.log('   Try speaking to see the bars change color:');
    console.log('   - RED: Below threshold');
    console.log('   - YELLOW: Near threshold (80%+)');
    console.log('   - GREEN: Above threshold');
  } else {
    console.log('❌ Threshold meter exists but is not visible');
  }

  await page.screenshot({ path: 'test-results/threshold-meter.png', fullPage: true });
  console.log('\n📸 Screenshot saved to test-results/threshold-meter.png');

  console.log('\n⏸️ Pausing for 15 seconds so you can test...');
  console.log('   Say the letter to see the threshold meter bars move!');
  await page.waitForTimeout(15000);

  await browser.close();
  console.log('\n✅ Test complete');
})();
