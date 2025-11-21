import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    permissions: ['microphone']
  });
  const page = await context.newPage();

  try {
    // Grant microphone permission
    await context.grantPermissions(['microphone']);

    console.log('Navigating to calibration page...');
    await page.goto('http://localhost:3001/calibrate');
    await page.waitForLoadState('networkidle');

    console.log('Taking screenshot of grid...');
    await page.screenshot({ path: '/tmp/calibration-grid.png' });

    console.log('Looking for letter cards...');
    const letterText = await page.getByText('Say: aaa (like "apple")').first();
    const parentCard = letterText.locator('..');

    console.log('Clicking on letter "a" card...');
    await parentCard.click();

    console.log('Waiting for modal to appear...');
    await page.waitForTimeout(1000);

    console.log('Taking screenshot of modal...');
    await page.screenshot({ path: '/tmp/calibration-modal.png' });

    console.log('Checking modal elements...');

    // Check if modal is present
    const modal = await page.locator('div.fixed.inset-0').first();
    const isVisible = await modal.isVisible();
    console.log('Modal visible:', isVisible);

    // Check if letter is displayed
    const letterDisplay = await page.locator('div.text-8xl').first();
    const letterDisplayText = await letterDisplay.textContent();
    console.log('Letter displayed:', letterDisplayText);

    // Check if status message is present
    const statusMessage = await page.locator('div.text-xl').first();
    const statusText = await statusMessage.textContent();
    console.log('Status message:', statusText);

    // Check if snapshot canvases are present
    const canvases = await page.locator('canvas').count();
    console.log('Number of snapshot canvases:', canvases);

    // Check close button
    const closeButton = await page.locator('button').filter({ hasText: '✕' }).first();
    const closeVisible = await closeButton.isVisible();
    console.log('Close button visible:', closeVisible);

    console.log('✅ Test completed successfully!');
    console.log('Screenshots saved:');
    console.log('  - /tmp/calibration-grid.png');
    console.log('  - /tmp/calibration-modal.png');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    await page.screenshot({ path: '/tmp/calibration-error.png' });
  } finally {
    await browser.close();
  }
})();
