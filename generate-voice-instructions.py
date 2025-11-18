#!/usr/bin/env python3
"""
Generate voice instruction files using OpenAI TTS API
Run: python3 generate-voice-instructions.py
"""

import os
import json
import urllib.request
from pathlib import Path

# Load API key from .env
env_path = Path(__file__).parent / '.env'
api_key = None

with open(env_path, 'r') as f:
    for line in f:
        if line.startswith('OPENAI_API_KEY='):
            api_key = line.strip().split('=', 1)[1]
            break

if not api_key:
    print('❌ OpenAI API key not found in .env file')
    exit(1)

# Create audio directory
audio_dir = Path(__file__).parent / 'audio' / 'instructions'
audio_dir.mkdir(parents=True, exist_ok=True)
print(f'✅ Created {audio_dir}')

# Voice instructions to generate
instructions = {
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
}

print(f'🎤 Generating {len(instructions)} voice instructions with OpenAI TTS (nova voice)...\n')

success_count = 0
fail_count = 0

for filename, text in instructions.items():
    try:
        # Prepare request
        url = 'https://api.openai.com/v1/audio/speech'
        headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }
        data = json.dumps({
            'model': 'tts-1-hd',
            'input': text,
            'voice': 'nova',
            'response_format': 'mp3'
        }).encode('utf-8')

        # Make request
        req = urllib.request.Request(url, data=data, headers=headers, method='POST')
        with urllib.request.urlopen(req) as response:
            # Save MP3
            file_path = audio_dir / f'{filename}.mp3'
            with open(file_path, 'wb') as f:
                f.write(response.read())

        print(f'✅ Generated: {filename}.mp3')
        success_count += 1

    except Exception as e:
        print(f'❌ {filename}: {str(e)}')
        fail_count += 1

print(f'\n📊 Summary:')
print(f'   ✅ Success: {success_count}/{len(instructions)}')
print(f'   ❌ Failed: {fail_count}/{len(instructions)}')
print(f'   💰 Estimated cost: $0.15')
print(f'\n✨ Voice files saved to: {audio_dir}')
