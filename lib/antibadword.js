'use strict';
const fs = require('fs');
const path = require('path');
const isAdmin = require('../lib/isAdmin');
const {
    setAntiBadword, getAntiBadword, removeAntiBadword,
    incrementWarningCount, resetWarningCount,
} = require('../lib/index');

let isOwnerOrSudo = null;
try { isOwnerOrSudo = require('../lib/isOwner'); } catch {}

// ── ANTI-DELETE LOOP FIX ──
const botDeletedCache = new Set();
function markAsBotDeleted(id) {
    botDeletedCache.add(id);
    setTimeout(() => botDeletedCache.delete(id), 1000 * 60 * 5);
}

const CUSTOM_PATH = path.join(__dirname, '../data/antibadword_custom.json');
const MAX_CUSTOM = 300;
const PAGE_ITEMS = 70;
const WRAP = 46;

function loadCustomAll() {
    try {
        if (!fs.existsSync(CUSTOM_PATH)) return {};
        return JSON.parse(fs.readFileSync(CUSTOM_PATH, 'utf8')) || {};
    } catch { return {}; }
}
function saveCustomAll(o) {
    try {
        const dir = path.dirname(CUSTOM_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(CUSTOM_PATH, JSON.stringify(o, null, 2));
    } catch {}
}
function getCustom(gid) {
    const r = loadCustomAll()[gid] || {};
    return {
        words: Array.isArray(r.words) ? r.words : [],
        phrases: Array.isArray(r.phrases) ? r.phrases : [],
    };
}
function setCustom(gid, data) {
    const all = loadCustomAll();
    if (!data.words.length && !data.phrases.length) delete all[gid];
    else all[gid] = data;
    saveCustomAll(all);
}

const BUILTIN_WORDS = [
    'gandu','madarchod','bhosdike','bsdk','fucker','bhosda','lauda','laude',
    'betichod','chutiya','jhant','randi','boobs','tits','nigga','fuck','dick',
    'bitch','bastard','asshole','lund','mc','lodu','benchod','shit','slut',
    'whore','cock','cunt','pussy','bhnchod','behenchod','kanjar','kanjri',
    'kutti','kutta','khanzir','khusra','hijra','harami','haramzada','haramzadi',
    'dalla','dalli','beghairat','begairat','lota','chawla','lun','lan','lann',
    'luli','tatta','tatte','fck','fuk','btch','bc',
];
const BUILTIN_PHRASES = [
    'maa ki chut','behen ki chut','teri ma ki chut','teri maa ki','bhen chod',
    'behen chod','maa chod','ma chod','behn chod','lun le','lund le',
    'gandi nasal','gandi nasal ka','gandi aulaad','gandi aulad','kutti nasal',
    'harami nasal','kanjar nasal','gandi zat','kameeni nasal','randi ki aulad',
    'randi ka bacha','kutti ka bacha','kutte ki nasal',
];

const _compiled = new Map();
function compiledFor(gid) {
    const hit = _compiled.get(gid);
    if (hit) return hit;
    const c = getCustom(gid);
    const built = {
        words: new Set([...BUILTIN_WORDS, ...c.words]),
        phrases: [...BUILTIN_PHRASES, ...c.phrases],
    };
    _compiled.set(gid, built);
    return built;
}
function invalidate(gid) { _compiled.delete(gid); }

const cleanText = (t) => (t || '').toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
const parseItems = (raw) => (raw || '').split(/[,\n]/).map(cleanText).filter(s => s && s.length > 1);
const tagOf = (id) => '@' + String(id).split('@')[0];
function wrapItems(items) {
    const lines = []; let cur = '';
    for (const it of items) {
        const piece = cur ? ', ' + it : it;
        if (cur && (cur.length + piece.length) > WRAP) { lines.push(cur + ','); cur = it; }
        else cur += piece;
    }
    if (cur) lines.push(cur);
    return lines.join('\n');
}
async function readCfg(chatId) {
    try { const c = await getAntiBadword(chatId); if (c) return c; } catch {}
    try { const c = await getAntiBadword(chatId, 'on'); if (c) return c; } catch {}
    return null;
}
async function canManage(sock, chatId, senderId) {
    if (typeof isOwnerOrSudo === 'function') {
        try { if (await isOwnerOrSudo(senderId, sock)) return true; } catch {}
    }
    try { const r = await isAdmin(sock, chatId, senderId); return !!r?.isSenderAdmin; } catch { return false; }
}
function helpText() {
    return [
        '╭─『 🛡️ ANTIBADWORD 』─',
        '│',
        '│ • $antibadword on - Enable',
        '│ • $antibadword off - Disable',
        '│ • $antibadword set delete/kick/warn',
        '│ • $antibadword add <word>',
        '│ • $antibadword remove <word>',
        '│ • $antibadword list [page]',
        '│ • $antibadword clear',
        '│ • $antibadword test <text>',
        '│',
        '╰─『 M-KING ⚡ 』─',
    ].join('\n');
}

async function handleAntiBadwordCommand(sock, chatId, message, match, senderIdArg, isSenderAdminArg) {
    const arg = (match || '').trim().toLowerCase();
    const sub = arg.split(/\s+/)[0];
    const rest = arg.slice(sub.length).trim();
    const senderId = senderIdArg || message.key.participant || message.key.remoteJid;
    if (!chatId.endsWith('@g.us')) {
        return sock.sendMessage(chatId, { text: '❌ Group only.' }, { quoted: message });
    }
    if (!arg) return sock.sendMessage(chatId, { text: helpText() }, { quoted: message });
    const isPublic = ['list', 'test'].includes(sub);
    if (!isPublic) {
        const ok = (typeof isSenderAdminArg === 'boolean' && isSenderAdminArg) ? true : await canManage(sock, chatId, senderId);
        if (!ok) return sock.sendMessage(chatId, { text: '⛔ Admin Only' }, { quoted: message });
    }
    if (sub === 'on') {
        const cfg = await readCfg(chatId);
        if (cfg?.enabled) return sock.sendMessage(chatId, { text: '✅ Already ON' }, { quoted: message });
        const act = cfg?.action || 'delete';
        await setAntiBadword(chatId, 'on', act);
        invalidate(chatId);
        return sock.sendMessage(chatId, { text: `╭─『 🛡️ ENABLED 』─\n│ • Status: ON\n│ • Action: ${act}\n╰─『 M-KING ⚡ 』─` }, { quoted: message });
    }
    if (sub === 'off') {
        const cfg = await readCfg(chatId);
        if (!cfg?.enabled) return sock.sendMessage(chatId, { text: '⚠️ Already OFF' }, { quoted: message });
        await removeAntiBadword(chatId);
        invalidate(chatId);
        return sock.sendMessage(chatId, { text: '╭─『 🚫 DISABLED 』─\n│ • OFF ho gaya\n╰─『 M-KING ⚡ 』─' }, { quoted: message });
    }
    if (sub === 'set') {
        if (!['delete', 'kick', 'warn'].includes(rest)) return sock.sendMessage(chatId, { text: '❌ Use: set delete/kick/warn' }, { quoted: message });
        const cfg = await readCfg(chatId);
        await setAntiBadword(chatId, cfg?.enabled ? 'on' : 'off', rest);
        return sock.sendMessage(chatId, { text: `✅ Action: ${rest}` }, { quoted: message });
    }
    if (sub === 'add') {
        const items = parseItems(rest);
        if (!items.length) return sock.sendMessage(chatId, { text: '❌ Example: add gali1, gali2' }, { quoted: message });
        const cur = getCustom(chatId); let added = 0;
        for (const it of items) {
            const isPhrase = it.includes(' ');
            const bucket = isPhrase ? cur.phrases : cur.words;
            const other = isPhrase ? cur.words : cur.phrases;
            if (bucket.includes(it) || other.includes(it) || BUILTIN_WORDS.includes(it) || BUILTIN_PHRASES.includes(it)) continue;
            if (cur.words.length + cur.phrases.length >= MAX_CUSTOM) continue;
            bucket.push(it); added++;
        }
        setCustom(chatId, cur); invalidate(chatId);
        return sock.sendMessage(chatId, { text: `✅ Added: ${added}` }, { quoted: message });
    }
    if (sub === 'remove' || sub === 'del') {
        const items = parseItems(rest);
        const cur = getCustom(chatId); let removed = 0;
        for (const it of items) for (const k of ['words','phrases']) { const i = cur[k].indexOf(it); if (i !== -1) { cur[k].splice(i,1); removed++; } }
        setCustom(chatId, cur); invalidate(chatId);
        return sock.sendMessage(chatId, { text: `🗑️ Removed: ${removed}` }, { quoted: message });
    }
    if (sub === 'clear') {
        const cur = getCustom(chatId); const total = cur.words.length + cur.phrases.length;
        if (!total) return sock.sendMessage(chatId, { text: '⚠️ No custom words' }, { quoted: message });
        setCustom(chatId, { words: [], phrases: [] }); invalidate(chatId);
        return sock.sendMessage(chatId, { text: `🧹 Cleared: ${total}` }, { quoted: message });
    }
    if (sub === 'list') {
        const cur = getCustom(chatId);
        const singles = [...cur.words, ...BUILTIN_WORDS];
        const phrases = [...cur.phrases, ...BUILTIN_PHRASES];
        const all = [...singles, ...phrases];
        return sock.sendMessage(chatId, { text: `🛡️ List Total: ${all.length}\n${wrapItems(all.slice(0, PAGE_ITEMS))}` }, { quoted: message });
    }
    if (sub === 'test') {
        if (!rest) return sock.sendMessage(chatId, { text: '❌ Example: test teri maa ki' }, { quoted: message });
        const { words, phrases } = compiledFor(chatId);
        const clean = cleanText(rest); const found = new Set();
        for (const t of clean.split(' ')) if (words.has(t)) found.add(t);
        for (const ph of phrases) if (clean.includes(ph)) found.add(ph);
        if (!found.size) return sock.sendMessage(chatId, { text: `✅ CLEAN: ${rest}` }, { quoted: message });
        return sock.sendMessage(chatId, { text: `🚫 FOUND: ${[...found].join(', ')}` }, { quoted: message });
    }
    return sock.sendMessage(chatId, { text: helpText() }, { quoted: message });
}

async function handleBadwordDetection(sock, chatId, message, userMessage, senderId) {
    if (!chatId.endsWith('@g.us')) return;
    if (message.key.fromMe) return;
    if (!userMessage) return;
    if (/^[.$]/.test(userMessage)) return;
    const cfg = await readCfg(chatId);
    if (!cfg?.enabled) return;
    const clean = cleanText(userMessage);
    if (!clean) return;
    const { words, phrases } = compiledFor(chatId);
    let matched = false;
    for (const t of clean.split(' ')) { if (t.length < 2) continue; if (words.has(t)) { matched = true; break; } }
    if (!matched) for (const ph of phrases) if (clean.includes(ph)) { matched = true; break; }
    if (!matched) return;

    const sender = senderId || message.key.participant;
    const { isBotAdmin, isSenderAdmin } = await isAdmin(sock, chatId, sender);
    if (isSenderAdmin) return;
    if (!isBotAdmin) return;

    try {
        markAsBotDeleted(message.key.id);
        await sock.sendMessage(chatId, { delete: message.key });
    } catch {}

    const tag = tagOf(sender);
    const action = cfg.action || 'delete';
    if (action === 'delete') return sock.sendMessage(chatId, { text: `🚫 ${tag} Gaali not allowed!`, mentions: [sender] });
    if (action === 'kick') {
        try { await sock.groupParticipantsUpdate(chatId, [sender], 'remove'); return sock.sendMessage(chatId, { text: `🚫 ${tag} kicked`, mentions: [sender] }); } catch { return; }
    }
    if (action === 'warn') {
        const count = await incrementWarningCount(chatId, sender);
        if (count >= 3) {
            try { await sock.groupParticipantsUpdate(chatId, [sender], 'remove'); await resetWarningCount(chatId, sender); return sock.sendMessage(chatId, { text: `🚫 ${tag} 3 warn = kick`, mentions: [sender] }); } catch { return sock.sendMessage(chatId, { text: `⚠️ ${tag} Warn ${count}/3`, mentions: [sender] }); }
        }
        return sock.sendMessage(chatId, { text: `⚠️ ${tag} Warn ${count}/3`, mentions: [sender] });
    }
}

module.exports = { handleAntiBadwordCommand, handleBadwordDetection, botDeletedCache };
