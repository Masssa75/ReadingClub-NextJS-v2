const { chromium } = require('playwright');

(async () => {
    console.log('🧪 Testing profile persistence on phonics2...\n');

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ permissions: ['microphone'] });
    const page = await context.newPage();

    // Listen to console logs
    page.on('console', msg => {
        const text = msg.text();
        if (text.includes('profile') || text.includes('Profile') || text.includes('calibration')) {
            console.log(`📝 ${text}`);
        }
    });

    // Go to phonics2
    console.log('1️⃣ Loading https://phuketcamp.com/phonics2/\n');
    await page.goto('https://phuketcamp.com/phonics2/');
    await page.waitForTimeout(3000);

    // Check localStorage
    const guestId1 = await page.evaluate(() => localStorage.getItem('guestProfileId'));
    const currentProfile1 = await page.evaluate(() => localStorage.getItem('currentProfile'));
    console.log(`\n📦 Initial localStorage:`);
    console.log(`   guestProfileId: ${guestId1}`);
    console.log(`   currentProfile: ${currentProfile1}`);

    // Simulate calibration (we won't actually record, just check the profile ID)
    const profileIdBefore = await page.evaluate(() => window.currentProfileId);
    console.log(`\n🎯 Current profile ID in memory: ${profileIdBefore}\n`);

    // Now refresh the page
    console.log('2️⃣ Refreshing page...\n');
    await page.reload();
    await page.waitForTimeout(3000);

    // Check localStorage again
    const guestId2 = await page.evaluate(() => localStorage.getItem('guestProfileId'));
    const currentProfile2 = await page.evaluate(() => localStorage.getItem('currentProfile'));
    console.log(`\n📦 After refresh localStorage:`);
    console.log(`   guestProfileId: ${guestId2}`);
    console.log(`   currentProfile: ${currentProfile2}`);

    const profileIdAfter = await page.evaluate(() => window.currentProfileId);
    console.log(`\n🎯 Profile ID after refresh: ${profileIdAfter}\n`);

    // Check if they match
    if (profileIdBefore === profileIdAfter) {
        console.log('✅ SUCCESS: Same profile ID before and after refresh');
    } else {
        console.log('❌ BUG: Different profile IDs!');
        console.log(`   Before: ${profileIdBefore}`);
        console.log(`   After:  ${profileIdAfter}`);
    }

    // Keep browser open to inspect
    console.log('\n⏸️  Browser will stay open for 30 seconds...');
    await page.waitForTimeout(30000);

    await browser.close();
})();
