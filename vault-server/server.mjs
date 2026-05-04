/**
 * שרת «כספת» מינימלי: שומר רק מחרוזת מוצפנת (ciphertext) מהלקוח.
 * אין פענוח בשרת — מפתחות רק אצל המשתמש.
 */
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '32mb' }));

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const JWT_SECRET = process.env.JWT_SECRET || '';
const PORT = parseInt(process.env.PORT || '3847', 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

if (!JWT_SECRET || JWT_SECRET.length < 16) {
  console.error('חובה להגדיר JWT_SECRET (לפחות 16 תווים אקראיים). עצירה.');
  process.exit(1);
}

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function userFile(email) {
  const h = crypto.createHash('sha256').update(String(email).toLowerCase().trim()).digest('hex');
  return path.join(DATA_DIR, `${h}.json`);
}

function readUser(email) {
  const f = userFile(email);
  if (!fs.existsSync(f)) return null;
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

function writeUser(email, rec) {
  fs.writeFileSync(userFile(email), JSON.stringify(rec));
}

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'vault' });
});

app.post('/api/register', async (req, res) => {
  try {
    const email = String(req.body?.email || '')
      .toLowerCase()
      .trim();
    const password = String(req.body?.password || '');
    if (!email.includes('@') || password.length < 6) {
      return res.status(400).json({ error: 'email_or_password_invalid' });
    }
    if (readUser(email)) return res.status(409).json({ error: 'exists' });
    const passwordHash = await bcrypt.hash(password, 12);
    writeUser(email, {
      email,
      passwordHash,
      vault: null,
    });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const email = String(req.body?.email || '')
      .toLowerCase()
      .trim();
    const password = String(req.body?.password || '');
    const u = readUser(email);
    if (!u) return res.status(401).json({ error: 'auth' });
    const ok = await bcrypt.compare(password, u.passwordHash);
    if (!ok) return res.status(401).json({ error: 'auth' });
    const token = jwt.sign({ sub: email }, JWT_SECRET, { expiresIn: '90d' });
    res.json({ ok: true, token, email: u.email });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server' });
  }
});

function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) return res.status(401).json({ error: 'auth' });
  try {
    req.user = jwt.verify(m[1], JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'auth' });
  }
}

app.get('/api/vault', auth, (req, res) => {
  try {
    const email = req.user.sub;
    const u = readUser(email);
    if (!u) return res.status(404).json({ error: 'missing' });
    const v = u.vault;
    if (!v || !v.ciphertext) {
      return res.json({ ciphertext: null, updatedAt: 0, version: 0, deviceId: null });
    }
    res.json({
      ciphertext: v.ciphertext,
      updatedAt: v.updatedAt || 0,
      version: v.version || 1,
      deviceId: v.deviceId || null,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server' });
  }
});

app.put('/api/vault', auth, (req, res) => {
  try {
    const email = req.user.sub;
    const u = readUser(email);
    if (!u) return res.status(404).json({ error: 'missing' });
    const { ciphertext, updatedAt, deviceId } = req.body || {};
    if (typeof ciphertext !== 'string' || ciphertext.length < 10) {
      return res.status(400).json({ error: 'bad_ciphertext' });
    }
    const nextVer = (u.vault && u.vault.version) ? u.vault.version + 1 : 1;
    const ts = typeof updatedAt === 'number' ? updatedAt : Date.now();
    u.vault = {
      ciphertext,
      updatedAt: ts,
      version: nextVer,
      deviceId: typeof deviceId === 'string' ? deviceId : null,
    };
    writeUser(email, u);
    res.json({ ok: true, version: nextVer, updatedAt: ts });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server' });
  }
});

app.listen(PORT, () => {
  console.log(`Vault server listening on http://127.0.0.1:${PORT}`);
  console.log(`DATA_DIR=${DATA_DIR}`);
});
