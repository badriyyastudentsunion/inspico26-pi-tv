import fs from 'fs';

const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const versionData = {
  version: packageJson.version || '1.0.0',
  buildTime: new Date().toISOString(),
  timestamp: Date.now()
};

fs.writeFileSync('./version.json', JSON.stringify(versionData, null, 2));
console.log('✅ Updated version.json:', versionData);
