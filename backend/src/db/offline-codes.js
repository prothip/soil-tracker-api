const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const dataDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const codesPath = path.join(dataDir, 'codes.json');

function loadCodes() {
  if (fs.existsSync(codesPath)) {
    return JSON.parse(fs.readFileSync(codesPath, 'utf8'));
  }
  return {
    codes: [
      { id: 1, code: 'DEMO-0001', expires_at: null, status: 'active', used_at: null, created_at: new Date().toISOString() }
    ],
    nextId: 2
  };
}

function saveCodes(data) {
  fs.writeFileSync(codesPath, JSON.stringify(data, null, 2));
}

function verifyCode(activationCode) {
  const data = loadCodes();
  const code = data.codes.find(c => c.code === activationCode.toUpperCase());
  if (!code) return { error: 'Invalid activation code' };
  if (code.status === 'used') return { error: 'Code already used' };
  if (code.expires_at && new Date(code.expires_at) < new Date()) {
    return { error: 'Code has expired' };
  }
  code.status = 'used';
  code.used_at = new Date().toISOString();
  saveCodes(data);
  return { success: true, deviceId: crypto.randomBytes(16).toString('hex') };
}

function listCodes() {
  return loadCodes().codes;
}

function generateCodes(count = 1, expiryDays = 30) {
  const data = loadCodes();
  const newCodes = [];
  for (let i = 0; i < count; i++) {
    const raw = crypto.randomBytes(4).toString('hex').toUpperCase();
    const code = `STP-${raw}`;
    const expiresAt = expiryDays > 0
      ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString()
      : null;
    data.codes.push({
      id: data.nextId++,
      code,
      expires_at: expiresAt,
      status: 'active',
      used_at: null,
      created_at: new Date().toISOString()
    });
    newCodes.push(data.codes[data.codes.length - 1]);
  }
  saveCodes(data);
  return newCodes;
}

function deleteCode(id) {
  const data = loadCodes();
  data.codes = data.codes.filter(c => c.id !== id);
  saveCodes(data);
}

module.exports = { verifyCode, listCodes, generateCodes, deleteCode };
