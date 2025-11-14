const { chromium } = require('playwright');

(async () => {
    console.log('🧪 Testing proficiency column fix with Marc profile...\n');

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ permissions: ['microphone'] });
    const page = await context.newPage();

    // Listen to console logs
    page.on('console', msg => {
        const text = msg.text();
        if (text.includes('406') || text.includes('proficiency') || text.includes('Pools') || text.includes('profile')) {
            console.log(`📝 ${text}`);
        }
    });

    // Listen to network requests for 406 errors
    page.on('response', response => {
        if (response.status() === 406) {
            console.log(`❌ 406 Error: ${response.url()}`);
        }
    });

    // Set localStorage to use Marc profile
    await page.goto('https://phuketcamp.com/phonics2/');

    // Wait for page to load
    await page.waitForTimeout(2000);

    // Set Marc profile in localStorage
    await page.evaluate(() => {
        localStorage.setItem('currentProfile', 'Marc');
    });

    console.log('\n✓ Set profile to Marc, refreshing page...\n');

    // Reload to pick up the Marc profile
    await page.reload();
    await page.waitForTimeout(5000);

    // Check for 406 errors in console
    const has406 = await page.evaluate(() => {
        const logs = window.performance.getEntries()
            .filter(entry => entry.name && entry.name.includes('calibrations'))
            .filter(entry => entry.responseStatus === 406);
        return logs.length > 0;
    });

    console.log(`\n📊 Has 406 errors: ${has406}\n`);

    // Click Play tab
    await page.click('text=Play');
    await page.waitForTimeout(3000);

    // Check proficiency data loaded
    const poolsData = await page.evaluate(() => {
        return {
            hasSession: window.currentSession !== undefined && window.currentSession !== null,
            profileId: window.currentProfileId
        };
    });

    console.log(`\n📦 Session data:`);
    console.log(`   Has session: ${poolsData.hasSession}`);
    console.log(`   Profile ID: ${poolsData.profileId}\n`);

    // Keep browser open for inspection
    console.log('⏸️  Browser will stay open for 30 seconds...');
    await page.waitForTimeout(30000);

    await browser.close();
})();
