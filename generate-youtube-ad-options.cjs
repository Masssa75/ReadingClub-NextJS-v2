#!/usr/bin/env node

/**
 * Generate YouTube ad voice options for activities section
 * Run: node generate-youtube-ad-options.js
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
const audioDir = path.join(__dirname, 'voice-instructions', 'Bamboo Valley Fly over Video');
if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
    console.log('✅ Created voice-instructions/Bamboo Valley Fly over Video directory');
}

// Voice options to generate
const voiceOptions = {
    'xmas 3_option1': "Our days are filled with gardening, animal care, baking, yoga, music, and arts & crafts. Children develop extraordinary curiosity—making them confident, capable learners who adapt and excel naturally—guided by caring English-speaking teachers in small groups.",
    'xmas 3_option2': "Gardening, animal care, baking, yoga, music, arts & crafts. Nurturing head, hands, and hearts—children build curiosity, creativity, and confidence—in small groups with caring English-speaking teachers.",
    'xmas 3_option3': "Our days are filled with gardening, animal care, baking, yoga, music, and arts & crafts. Children develop strong inner motivation and love for learning—guided by caring English-speaking teachers in small groups.",
    'xmas 3_option4': "Gardening, animal care, baking, yoga, music, and arts & crafts. Building curious, confident, capable children—in small groups with caring English-speaking teachers."
};

// Generate voice for each option
async function generateVoice(filename, text) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            model: 'tts-1-hd',
            input: text,
            voice: 'nova',
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

// Update metadata.json
function updateMetadata(options) {
    const metadataPath = path.join(__dirname, 'voice-instructions', 'metadata.json');
    let metadata = {};

    // Read existing metadata if it exists
    if (fs.existsSync(metadataPath)) {
        const content = fs.readFileSync(metadataPath, 'utf8');
        metadata = JSON.parse(content);
    }

    // Add new entries
    for (const [filename, text] of Object.entries(options)) {
        const key = `Bamboo Valley Fly over Video/${filename}.mp3`;
        metadata[key] = {
            text: text,
            voice: 'nova',
            speed: '1',
            folder: 'Bamboo Valley Fly over Video'
        };
    }

    // Write updated metadata
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    console.log(`✅ Updated metadata.json with ${Object.keys(options).length} entries`);
}

// Main execution
async function main() {
    console.log('🎤 Generating YouTube ad voice options with OpenAI TTS (nova voice)...\n');

    const entries = Object.entries(voiceOptions);
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
    console.log(`\n✨ Voice files saved to: ${audioDir}`);

    // Update metadata.json if any files were successfully generated
    if (successCount > 0) {
        updateMetadata(voiceOptions);
    }
}

main().catch(console.error);
