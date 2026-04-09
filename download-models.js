// Downloads face-api.js model files to public/models for local serving
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const MODELS_DIR = path.join(__dirname, 'public', 'models');
const BASE_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';

const MODEL_FILES = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2',
  'face_expression_model-weights_manifest.json',
  'face_expression_model-shard1',
];

fs.mkdirSync(MODELS_DIR, { recursive: true });

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const get = url.startsWith('https') ? https.get : http.get;
    get(url, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(dest);
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', err => { file.close(); fs.unlinkSync(dest); reject(err); });
  });
}

async function main() {
  console.log('  Downloading face-api.js models...\n');
  for (const file of MODEL_FILES) {
    const dest = path.join(MODELS_DIR, file);
    if (fs.existsSync(dest)) {
      console.log(`  ✓ ${file} (already exists)`);
      continue;
    }
    const url = `${BASE_URL}/${file}`;
    process.stdout.write(`  ↓ ${file}...`);
    try {
      await download(url, dest);
      console.log(' ✓');
    } catch (err) {
      console.log(` ✗ (${err.message})`);
    }
  }
  console.log('\n  Models download complete!\n');
}

main();
