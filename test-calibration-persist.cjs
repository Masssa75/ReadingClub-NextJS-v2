const { chromium } = require('playwright');

(async () => {
    console.log('🧪 Testing calibration persistence on phonics2...\n');

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ permissions: ['microphone'] });
    const page = await context.newPage();

    // Listen to console logs
    page.on('console', msg => {
        const text = msg.text();
        if (text.includes('Saved calibration') || text.includes('Loaded') || text.includes('profile')) {
            console.log(`📝 ${text}`);
        }
    });

    // Go to phonics2
    console.log('1️⃣ Loading https://phuketcamp.com/phonics2/\n');
    await page.goto('https://phuketcamp.com/phonics2/');
    await page.waitForTimeout(4000);

    // Wait for profile to be initialized
    await page.waitForFunction(() => window.currentProfileId !== undefined && window.currentProfileId !== null, { timeout: 10000 });

    const profileIdBefore = await page.evaluate(() => window.currentProfileId);
    console.log(`\n🎯 Profile ID initialized: ${profileIdBefore}\n`);

    // Check how many calibrations are loaded
    const calibrationsCountBefore = await page.evaluate(() => Object.keys(window.calibrationData || {}).length);
    console.log(`📊 Calibrations loaded: ${calibrationsCountBefore}\n`);

    // Click on the 'a' letter card to open calibration modal
    console.log('2️⃣ Opening calibration modal for letter "a"...\n');
    await page.click('text=aaa (like "apple")');
    await page.waitForTimeout(2000);

    // Click "Start Recording" if there's a button
    const startBtn = await page.$('text=Start Recording');
    if (startBtn) {
        console.log('3️⃣ Clicking "Start Recording"...\n');
        await startBtn.click();
        await page.waitForTimeout(1000);
    }

    // Look for capture boxes and click the first one
    console.log('4️⃣ Looking for capture boxes...\n');
    const captureBox = await page.$('.modal-capture-box:not(.captured)');
    if (captureBox) {
        console.log('5️⃣ Clicking capture box to record...\n');
        await captureBox.click();
        await page.waitForTimeout(2000); // Wait for recording
    }

    // Check if we can find a "Save" or "Finish" button
    const finishBtn = await page.$('text=Finish');
    if (finishBtn) {
        const isEnabled = await finishBtn.isEnabled();
        console.log(`\n🔘 Finish button found, enabled: ${isEnabled}\n`);
    }

    console.log('\n⏸️  Pausing for manual testing...');
    console.log('   Please calibrate letter "a" manually if modal is open');
    console.log('   Or check if calibration was already saved');
    console.log('   Browser will stay open for 60 seconds...\n');

    await page.waitForTimeout(60000);

    // Check calibrations after manual calibration
    const calibrationsCountAfter = await page.evaluate(() => Object.keys(window.calibrationData || {}).length);
    console.log(`\n📊 Calibrations after manual work: ${calibrationsCountAfter}`);

    // Now refresh and check if they persist
    console.log('\n6️⃣ Refreshing page to test persistence...\n');
    await page.reload();
    await page.waitForTimeout(5000);

    // Wait for profile to be initialized again
    await page.waitForFunction(() => window.currentProfileId !== undefined && window.currentProfileId !== null, { timeout: 10000 });

    const profileIdAfter = await page.evaluate(() => window.currentProfileId);
    const calibrationsCountAfterRefresh = await page.evaluate(() => Object.keys(window.calibrationData || {}).length);

    console.log(`\n🎯 Profile ID after refresh: ${profileIdAfter}`);
    console.log(`📊 Calibrations after refresh: ${calibrationsCountAfterRefresh}\n`);

    if (profileIdBefore === profileIdAfter) {
        console.log('✅ Profile ID persisted correctly');
    } else {
        console.log('❌ Profile ID changed!');
    }

    if (calibrationsCountAfterRefresh > 0) {
        console.log('✅ Calibrations persisted correctly');
    } else {
        console.log('❌ Calibrations were lost!');
    }

    console.log('\n⏸️  Keeping browser open for inspection...');
    await page.waitForTimeout(30000);

    await browser.close();
})();
