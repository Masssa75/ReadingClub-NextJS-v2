#!/usr/bin/env node

/**
 * Generate voice instruction files using OpenAI TTS API
 * Run: node generate-voice-instructions.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Load API key from .env
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const apiKeyMatch = envContent.match(/OPENAI_API_KEY=(.+)/);
const OPENAI_API_KEY = apiKeyMatch ? apiKeyMatch[1].trim() : null;

if (!OPENAI_API_KEY) {
    console.error('❌ OpenAI API key not found in .env file');
    process.exit(1);
}

// Create audio directory
const audioDir = path.join(__dirname, 'audio', 'instructions');
if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
    console.log('✅ Created audio/instructions directory');
}

// Voice instructions to generate
const instructions = {
    'welcome': "Welcome to Reading Club! Let's learn the alphabet together!",
    'click-to-start': "Tap anywhere to start learning!",
    'great-job': "Great job! You're doing amazing!",
    'try-again': "Almost there! Let's try that again!",
    'perfect': "Perfect! That was excellent!",
    'next-letter': "Wonderful! Let's move to the next letter!",
    'say-sound': "Now say this sound:",
    'listen-carefully': "Listen carefully to this sound",
    'your-turn': "Your turn! Say the sound now!",
    'too-quiet': "I can't hear you! Speak a bit louder!",
    'good-volume': "Good! That's the right volume!",
    'all-done': "Amazing! You've completed all the letters!",
    'ready': "Are you ready? Let's begin!",
    'keep-going': "Keep going! You're doing great!",
    'celebrate': "Yay! You did it! Time to celebrate!"
};

// Generate voice for each instruction
async function generateVoice(filename, text) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            model: 'tts-1-hd',
            input: text,
            voice: 'nova', // Kid-friendly voice
            response_format: 'mp3'
        });

        const options = {
            hostname: 'api.openai.com',
            port: 443,
            path: '/v1/audio/speech',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            if (res.statusCode !== 200) {
                let errorData = '';
                res.on('data', chunk => errorData += chunk);
                res.on('end', () => {
                    console.error(`❌ ${filename}: HTTP ${res.statusCode} - ${errorData}`);
                    reject(new Error(`HTTP ${res.statusCode}`));
                });
                return;
            }

            const filePath = path.join(audioDir, `${filename}.mp3`);
            const fileStream = fs.createWriteStream(filePath);

            res.pipe(fileStream);

            fileStream.on('finish', () => {
                fileStream.close();
                console.log(`✅ Generated: ${filename}.mp3`);
                resolve();
            });

            fileStream.on('error', (err) => {
                fs.unlinkSync(filePath);
                reject(err);
            });
        });

        req.on('error', (err) => {
            console.error(`❌ ${filename}: ${err.message}`);
            reject(err);
        });

        req.write(postData);
        req.end();
    });
}

// Main execution
async function main() {
    console.log('🎤 Generating voice instructions with OpenAI TTS (nova voice)...\n');

    const entries = Object.entries(instructions);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < entries.length; i++) {
        const [filename, text] = entries[i];
        try {
            await generateVoice(filename, text);
            successCount++;
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (err) {
            console.error(`Failed to generate ${filename}:`, err.message);
            failCount++;
        }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Success: ${successCount}/${entries.length}`);
    console.log(`   ❌ Failed: ${failCount}/${entries.length}`);
    console.log(`   💰 Estimated cost: $${(successCount * 0.030 * text.length / 1000).toFixed(4)}`);
    console.log(`\n✨ Voice files saved to: ${audioDir}`);
}

main().catch(console.error);
