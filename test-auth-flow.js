const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    permissions: ['microphone']
  });
  const page = await context.newPage();

  // Listen to console logs
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('✅') || text.includes('❌') || text.includes('📝') || text.includes('🔍') || text.includes('⚠️')) {
      console.log('BROWSER:', text);
    }
  });

  console.log('🧪 Test 1: Initial load - should create guest profile');
  await page.goto('file:///Users/marcschwyn/Desktop/projects/DRC/index-1.4.html');

  // Wait for page to load
  await page.waitForTimeout(3000);

  // Check localStorage
  const guestProfileId1 = await page.evaluate(() => {
    return localStorage.getItem('guestProfileId');
  });
  console.log('📦 Guest Profile ID after first load:', guestProfileId1);

  // Get current profile from page
  const profileCount1 = await page.evaluate(() => {
    return Object.keys(calibrationData || {}).length;
  });
  console.log('📊 Calibrations loaded:', profileCount1);

  console.log('\n🧪 Test 2: Refresh page - should load same profile');
  await page.reload();
  await page.waitForTimeout(3000);

  const guestProfileId2 = await page.evaluate(() => {
    return localStorage.getItem('guestProfileId');
  });
  console.log('📦 Guest Profile ID after refresh:', guestProfileId2);

  if (guestProfileId1 === guestProfileId2) {
    console.log('✅ PASS: Profile ID persisted across refresh');
  } else {
    console.log('❌ FAIL: Profile ID changed!');
    console.log('  Expected:', guestProfileId1);
    console.log('  Got:', guestProfileId2);
  }

  console.log('\n🧪 Test 3: Clear localStorage and reload - should create new profile');
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload();
  await page.waitForTimeout(3000);

  const guestProfileId3 = await page.evaluate(() => {
    return localStorage.getItem('guestProfileId');
  });
  console.log('📦 Guest Profile ID after clear:', guestProfileId3);

  if (guestProfileId3 && guestProfileId3 !== guestProfileId1) {
    console.log('✅ PASS: New profile created after clear');
  } else {
    console.log('❌ FAIL: Profile not recreated properly');
  }

  console.log('\n🧪 Test 4: Check Supabase profiles table');
  const profiles = await page.evaluate(async () => {
    const { data, error } = await supabase.from('profiles').select('*');
    return { data, error };
  });

  console.log('📊 Total profiles in Supabase:', profiles.data?.length || 0);
  if (profiles.data) {
    profiles.data.forEach((p, i) => {
      console.log(`  Profile ${i + 1}:`, p.name, '-', p.id.substring(0, 8) + '...');
    });
  }

  console.log('\n✅ Test complete!');

  // Keep browser open for inspection
  console.log('\nPress Ctrl+C to close browser...');
  await page.waitForTimeout(60000);

  await browser.close();
})();
