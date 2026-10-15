const fs = require('fs');
const path = require('path');

const STATIC_OWNER_NUMBERS = Object.freeze([
  '923292460369',
]);

function loadStaticOwners() {
  try {
    const file = path.join(__dirname, 'data', 'owner.json');
    const owners = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (Array.isArray(owners)) {
      const cleaned = [...new Set(owners.map(n => String(n).replace(/\D/g, '')).filter(Boolean))];
      if (cleaned.length) return cleaned;
    }
  } catch {}
  return [...STATIC_OWNER_NUMBERS];
}

const ownerNumbers = Object.freeze(loadStaticOwners());

const settings = {
  packname: 'Mursalin King👑',
  botName: "M-KING BOT",
  sessionName: "M-king",   // per-instance display name (shown in greetings + $bots)
  botOwner: 'Mursalin King👑', // Your name
  // Static owners only. PAIRING_NUMBER is for pairing this deployment and is
  // intentionally not used as an owner contact or authorization source.
  ownerNumbers,
  ownerNumber: ownerNumbers[0] || '',
  ownerContact: ownerNumbers[0] || '',
  giphyApiKey: 'NrSjG6var2uiuSYDm0xTqCX0xcFgGj4s',
  commandMode: "private",
  maxStoreMessages: 20,
  storeWriteInterval: 10000,
  description: "Daratech - a multi-purpose WhatsApp bot with 1000+ commands.",
  version: "1.0.0",
  // GitHub personal access token — used by $savedoc to read/write files
  // Generate one at: https://github.com/settings/tokens (needs repo scope)
  githubToken: process.env.GITHUB_TOKEN || "",

  // GitHub repo — used for git auto-update AND as ZIP fallback
  githubRepo: "https://github.com/mursalin3352/M-KING-Bot",
  githubBranch: "main",
  updateZipUrl: "https://github.com/mursalin3352/M-KING-Bot/archive/refs/heads/main.zip
unzip main.zip",
  // How often (in seconds) the bot checks for updates automatically (default: 39s)
  autoUpdateInterval: 39,
};

module.exports = settings;
