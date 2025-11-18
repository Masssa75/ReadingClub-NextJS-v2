import express from 'express';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3333;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Create voice-instructions directory if it doesn't exist
const voiceDir = path.join(__dirname, 'voice-instructions');
if (!fs.existsSync(voiceDir)) {
  fs.mkdirSync(voiceDir);
}

const metadataPath = path.join(voiceDir, 'metadata.json');

// Load or initialize metadata
function loadMetadata() {
  try {
    if (fs.existsSync(metadataPath)) {
      return JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    }
  } catch (error) {
    console.error('Error loading metadata:', error);
  }
  return {};
}

function saveMetadata(metadata) {
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
}

app.use(express.json());
app.use(express.static(__dirname));
app.use('/voice-instructions', express.static(voiceDir));

// List available folders
app.get('/list-folders', (req, res) => {
  try {
    const items = fs.readdirSync(voiceDir);
    const folders = items
      .filter(item => fs.statSync(path.join(voiceDir, item)).isDirectory())
      .sort();
    res.json({ folders: ['', ...folders] }); // Empty string = root folder
  } catch (error) {
    res.json({ folders: [''] });
  }
});

// Generate voice instruction
app.post('/generate-voice', async (req, res) => {
  try {
    const { text, filename, voice = 'nova', speed = 1.0, folder = '' } = req.body;

    if (!text || !filename) {
      return res.status(400).json({ error: 'Text and filename are required' });
    }

    const targetDir = folder ? path.join(voiceDir, folder) : voiceDir;

    // Create folder if it doesn't exist
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    console.log(`Generating: ${filename}.mp3 with voice "${voice}" in folder "${folder || 'root'}"`);

    const mp3 = await openai.audio.speech.create({
      model: "tts-1-hd",
      voice: voice,
      input: text,
      speed: parseFloat(speed)
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    const filepath = path.join(targetDir, `${filename}.mp3`);

    await fs.promises.writeFile(filepath, buffer);

    // Save metadata
    const metadata = loadMetadata();
    const metadataKey = folder ? `${folder}/${filename}.mp3` : `${filename}.mp3`;
    metadata[metadataKey] = { text, voice, speed, folder };
    saveMetadata(metadata);

    console.log(`✓ Saved: ${folder ? folder + '/' : ''}${filename}.mp3`);
    res.json({
      success: true,
      filename: `${filename}.mp3`,
      path: filepath,
      folder
    });

  } catch (error) {
    console.error('Error generating voice:', error);
    res.status(500).json({ error: error.message });
  }
});

// List existing voice files
app.get('/list-voices', (req, res) => {
  try {
    const folder = req.query.folder || '';
    const targetDir = folder ? path.join(voiceDir, folder) : voiceDir;
    const metadata = loadMetadata();

    // Check if directory exists
    if (!fs.existsSync(targetDir)) {
      return res.json({ files: [] });
    }

    const files = fs.readdirSync(targetDir)
      .filter(f => f.endsWith('.mp3'))
      .map(f => {
        const stats = fs.statSync(path.join(targetDir, f));
        const metadataKey = folder ? `${folder}/${f}` : f;
        return {
          name: f,
          path: path.join(targetDir, f),
          text: metadata[metadataKey]?.text || '',
          voice: metadata[metadataKey]?.voice || 'nova',
          speed: metadata[metadataKey]?.speed || 1.0,
          favorite: metadata[metadataKey]?.favorite || false,
          folder: folder,
          modified: stats.mtime.getTime()
        };
      })
      .sort((a, b) => b.modified - a.modified); // Newest first
    res.json({ files });
  } catch (error) {
    console.error('Error listing files:', error);
    res.json({ files: [] });
  }
});

// Toggle favorite
app.post('/toggle-favorite', (req, res) => {
  try {
    const { filename, folder } = req.body;
    const metadata = loadMetadata();
    const metadataKey = folder ? `${folder}/${filename}` : filename;

    if (!metadata[metadataKey]) {
      metadata[metadataKey] = {};
    }

    metadata[metadataKey].favorite = !metadata[metadataKey].favorite;
    saveMetadata(metadata);

    res.json({ success: true, favorite: metadata[metadataKey].favorite });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rename file
app.post('/rename-file', (req, res) => {
  try {
    const { oldName, newName, folder } = req.body;

    if (!oldName || !newName) {
      return res.status(400).json({ error: 'Old name and new name are required' });
    }

    // Ensure .mp3 extension
    const newNameWithExt = newName.endsWith('.mp3') ? newName : `${newName}.mp3`;

    const targetDir = folder ? path.join(voiceDir, folder) : voiceDir;
    const oldPath = path.join(targetDir, oldName);
    const newPath = path.join(targetDir, newNameWithExt);

    if (!fs.existsSync(oldPath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (fs.existsSync(newPath)) {
      return res.status(400).json({ error: 'A file with that name already exists' });
    }

    // Rename the file
    fs.renameSync(oldPath, newPath);

    // Update metadata
    const metadata = loadMetadata();
    const oldKey = folder ? `${folder}/${oldName}` : oldName;
    const newKey = folder ? `${folder}/${newNameWithExt}` : newNameWithExt;

    if (metadata[oldKey]) {
      metadata[newKey] = metadata[oldKey];
      delete metadata[oldKey];
      saveMetadata(metadata);
    }

    console.log(`✓ Renamed: ${oldKey} → ${newKey}`);
    res.json({ success: true, newName: newNameWithExt });
  } catch (error) {
    console.error('Error renaming file:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n🎤 Voice Generator Server running!`);
  console.log(`📂 Saving files to: ${voiceDir}`);
  console.log(`🌐 Open: http://localhost:${PORT}/voice-generator.html\n`);
});
