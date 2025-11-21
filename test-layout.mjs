import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log('🔍 Navigating to http://localhost:3001...');
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });

    console.log('\n📐 Checking layout dimensions...');

    // Check container dimensions
    const container = await page.locator('div.bg-black\\/70').boundingBox();
    console.log('Container:', container);

    // Check if content overflows
    const body = await page.locator('body').boundingBox();
    console.log('Body:', body);

    // Check tabs
    const tabs = await page.locator('div.flex.gap-2.border-b-2').boundingBox();
    console.log('Tabs:', tabs);

    // Check for any elements outside container
    const allElements = await page.locator('*').all();
    let overflowCount = 0;

    for (const el of allElements) {
      const box = await el.boundingBox();
      if (box && container) {
        if (box.x < container.x || box.y < container.y ||
            box.x + box.width > container.x + container.width ||
            box.y + box.height > container.y + container.height) {
          const tag = await el.evaluate(e => e.tagName);
          const classes = await el.evaluate(e => e.className);
          if (box.width > 0 && box.height > 0) {
            console.log(`⚠️ Overflow: ${tag} (${classes})`);
            overflowCount++;
          }
        }
      }
    }

    console.log(`\n${overflowCount > 0 ? '❌' : '✅'} Found ${overflowCount} overflowing elements`);

    // Take screenshot
    await page.screenshot({ path: 'layout-debug.png', fullPage: true });
    console.log('📸 Screenshot saved to layout-debug.png');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
})();
