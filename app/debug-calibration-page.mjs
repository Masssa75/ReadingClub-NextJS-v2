import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 }
  });

  try {
    console.log('Navigating to calibration page...');
    await page.goto('http://localhost:3001/calibrate');
    await page.waitForLoadState('networkidle');

    console.log('Taking screenshot...');
    await page.screenshot({ path: '/tmp/calibration-debug.png' });

    console.log('Getting page HTML...');
    const bodyHTML = await page.locator('body').innerHTML();
    console.log('Body HTML (first 500 chars):', bodyHTML.substring(0, 500));

    console.log('Getting all text content...');
    const allText = await page.locator('body').textContent();
    console.log('All text:', allText);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
})();
