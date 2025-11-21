import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log('🔍 Navigating to http://localhost:3001...');
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });

    await page.waitForTimeout(1000);

    console.log('\n📐 Checking layout dimensions...');

    // Get container
    const container = await page.locator('.bg-black\\/70').first().boundingBox();
    console.log('Container:', container);

    // Get info box
    const infoBox = await page.locator('.bg-white\\/10.border-l-4').first().boundingBox();
    console.log('Info Box:', infoBox);

    // Check if info box overflows container
    if (container && infoBox) {
      const overflowX = (infoBox.x + infoBox.width) > (container.x + container.width);
      const overflowY = (infoBox.y + infoBox.height) > (container.y + container.height);

      console.log('\n📊 Overflow Check:');
      console.log('Info box right edge:', infoBox.x + infoBox.width);
      console.log('Container right edge:', container.x + container.width);
      console.log('Overflow X:', overflowX ? '❌ YES' : '✅ NO');
      console.log('Overflow Y:', overflowY ? '❌ YES' : '✅ NO');

      if (overflowX || overflowY) {
        console.log('\n⚠️ OVERFLOW DETECTED!');
        console.log('Difference X:', (infoBox.x + infoBox.width) - (container.x + container.width), 'px');
      }
    }

    // Take screenshot
    await page.screenshot({ path: 'layout-debug-v2.png', fullPage: true });
    console.log('\n📸 Screenshot saved to layout-debug-v2.png');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
})();
