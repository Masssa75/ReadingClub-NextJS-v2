const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Simple HTTP server to avoid CORS issues
function startServer() {
    const server = http.createServer((req, res) => {
        const filePath = path.join(__dirname, 'index-1.4.html');
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end('Error loading file');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
    });

    server.listen(3000);
    console.log('🌐 Server running at http://localhost:3000');
    return server;
}

(async () => {
    const server = startServer();

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
        permissions: ['microphone']
    });
    const page = await context.newPage();

    // Listen to console logs
    page.on('console', msg => {
        const text = msg.text();
        if (text.includes('✅') || text.includes('❌') || text.includes('📝') ||
            text.includes('🔍') || text.includes('⚠️') || text.includes('Switched to profile')) {
            console.log('BROWSER:', text);
        }
    });

    console.log('\n🧪 Test 1: Initial load with Default profile');
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(3000);

    // Get profile info
    const profile1 = await page.evaluate(() => {
        return {
            name: currentProfile,
            id: currentProfileId?.substring(0, 8),
            calibrationCount: Object.keys(calibrationData || {}).length
        };
    });
    console.log('📊 Default profile:', profile1.name, '-', profile1.id, '- Calibrations:', profile1.calibrationCount);

    console.log('\n🧪 Test 2: Create new test profile');
    // Click New Profile button
    await page.click('text=➕ New Profile');
    await page.waitForTimeout(500);

    // Fill in profile name
    await page.keyboard.type('TestProfile123');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    const profile2 = await page.evaluate(() => {
        return {
            name: currentProfile,
            id: currentProfileId?.substring(0, 8),
            calibrationCount: Object.keys(calibrationData || {}).length
        };
    });
    console.log('📊 New profile:', profile2.name, '-', profile2.id, '- Calibrations:', profile2.calibrationCount);

    console.log('\n🧪 Test 3: Switch back to Default profile');
    await page.selectOption('#profileSelect', 'Default');
    await page.waitForTimeout(2000);

    const profile3 = await page.evaluate(() => {
        return {
            name: currentProfile,
            id: currentProfileId?.substring(0, 8),
            calibrationCount: Object.keys(calibrationData || {}).length
        };
    });
    console.log('📊 Back to Default:', profile3.name, '-', profile3.id, '- Calibrations:', profile3.calibrationCount);

    console.log('\n🧪 Test 4: Verify calibrations persisted');
    if (profile1.calibrationCount === profile3.calibrationCount) {
        console.log('✅ PASS: Calibrations persisted after profile switch');
        console.log(`   Expected: ${profile1.calibrationCount}, Got: ${profile3.calibrationCount}`);
    } else {
        console.log('❌ FAIL: Calibrations lost!');
        console.log(`   Expected: ${profile1.calibrationCount}, Got: ${profile3.calibrationCount}`);
    }

    console.log('\n🧪 Test 5: Check Supabase profiles');
    const profiles = await page.evaluate(async () => {
        const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(5);
        return {
            data: data?.map(p => ({
                name: p.name,
                id: p.id.substring(0, 8),
                calibrationCount: '(need to query)'
            })),
            error
        };
    });

    console.log('📊 Recent profiles in Supabase:');
    if (profiles.data) {
        profiles.data.forEach((p, i) => {
            console.log(`  ${i + 1}. ${p.name} - ${p.id}...`);
        });
    }

    console.log('\n✅ Test complete!');
    console.log('\nPress Ctrl+C to close...');

    await page.waitForTimeout(5000);
    await browser.close();
    server.close();
})();
