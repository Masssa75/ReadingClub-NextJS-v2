const { chromium } = require('playwright');

/**
 * Test voice detection with synthetic audio data
 * Simulates microphone input by injecting fake frequency data
 */

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Listen for console logs
  page.on('console', msg => {
    console.log('  ', msg.text());
  });

  console.log('\n🎤 Starting Synthetic Audio Test...\n');

  try {
    // Navigate to Play tab
    console.log('1️⃣ Loading Play tab');
    await page.goto('http://localhost:3001/play');
    await page.waitForTimeout(2000);

    // Inject code to simulate microphone with synthetic audio
    await page.evaluate(() => {
      console.log('🔧 Injecting synthetic audio simulator...');

      // Override getUserMedia to provide fake audio stream
      const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

      navigator.mediaDevices.getUserMedia = async function(constraints) {
        console.log('🎙️ getUserMedia called, returning synthetic stream');

        // Create a real AudioContext
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        const audioContext = new AudioContextClass();

        // Create an oscillator to generate tone (simulating voice)
        const oscillator = audioContext.createOscillator();
        oscillator.frequency.value = 200; // 200 Hz tone (low voice frequency)
        oscillator.type = 'sine';

        // Create gain node to control volume
        const gainNode = audioContext.createGain();
        gainNode.gain.value = 0.5; // Medium volume

        // Create media stream destination
        const destination = audioContext.createMediaStreamDestination();

        // Connect: oscillator → gain → destination
        oscillator.connect(gainNode);
        gainNode.connect(destination);

        // Start oscillator
        oscillator.start();

        console.log('✅ Synthetic audio stream created with 200Hz tone');

        // Store reference so we can modulate it later
        window.__syntheticAudio = {
          audioContext,
          oscillator,
          gainNode,
          destination
        };

        // Return the synthetic stream
        return destination.stream;
      };

      console.log('✅ Synthetic audio injector ready');
    });

    // Click Start button
    console.log('\n2️⃣ Clicking Start button');
    const startBtn = await page.locator('button:has-text("Start")').first();
    await startBtn.click();
    await page.waitForTimeout(1000);

    console.log('\n3️⃣ Monitoring voice detection for 10 seconds...');
    console.log('    (You should see volume detection logs every second)\n');

    // Wait and watch the console logs
    await page.waitForTimeout(10000);

    // Simulate speaking louder by increasing gain
    console.log('\n4️⃣ Increasing volume to simulate louder sound...\n');
    await page.evaluate(() => {
      if (window.__syntheticAudio) {
        window.__syntheticAudio.gainNode.gain.value = 1.0; // Full volume
        console.log('📢 Volume increased to maximum');
      }
    });

    await page.waitForTimeout(5000);

    // Try changing frequency to simulate different sounds
    console.log('\n5️⃣ Changing frequency to simulate different letter...\n');
    await page.evaluate(() => {
      if (window.__syntheticAudio) {
        window.__syntheticAudio.oscillator.frequency.value = 500; // Higher frequency
        console.log('🎵 Frequency changed to 500Hz');
      }
    });

    await page.waitForTimeout(5000);

    console.log('\n✅ Test complete! Check the logs above to see if:');
    console.log('   - Voice detection loop is running (volume logs every second)');
    console.log('   - Volume values are > 0');
    console.log('   - Pattern matching is being attempted');
    console.log('\n👀 Browser window kept open for inspection...');

    await page.waitForTimeout(30000); // Keep open 30 seconds

  } catch (error) {
    console.error('\n❌ Test error:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
})();
