import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 }
  });

  const page = await context.newPage();

  try {
    // Navigate to Next.js version
    await page.goto('http://localhost:3001/calibrate');
    await page.waitForTimeout(2000);

    // Take full page screenshot
    await page.screenshot({
      path: 'nextjs-version.png',
      fullPage: false
    });

    console.log('✅ Screenshot saved: nextjs-version.png');
    console.log('👀 Browser window left open for manual inspection');
    console.log('Press Ctrl+C when done');

    // Keep browser open
    await page.waitForTimeout(300000); // 5 minutes

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
})();
