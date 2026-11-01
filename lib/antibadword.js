'use strict';
const fs = require('fs');
const path = require('path');

const isAdmin = require('../lib/isAdmin');
const {
    setAntiBadword, getAntiBadword, removeAntiBadword,
    incrementWarningCount, resetWarningCount,
} = require('../lib/index');

let isOwnerOrSudo = null;
try { isOwnerOrSudo = require('../lib/isOwner'); } catch { }

// ── Custom words storage (per group) ───────────────────
const CUSTOM_PATH = path.join(__dirname, '../data/antibadword_custom.json');
const MAX_CUSTOM = 300;
const PAGE_SIZE = 60;

function loadCustomAll() {
    try {
        if (!fs.existsSync(CUSTOM_PATH)) return {};
        return JSON.parse(fs.readFileSync(CUSTOM_PATH, 'utf8')) || {};
    } catch { return {}; }
}

function saveCustomAll(obj) {
    try {
        const dir = path.dirname(CUSTOM_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(CUSTOM_PATH, JSON.stringify(obj, null, 2));
    } catch { }
}

function getCustom(groupId) {
    const rec = loadCustomAll()[groupId] || {};
    return {
        words: Array.isArray(rec.words) ? rec.words : [],
        phrases: Array.isArray(rec.phrases) ? rec.phrases : [],
    };
}

function setCustom(groupId, data) {
    const all = loadCustomAll();
    if (!data.words.length && !data.phrases.length) delete all[groupId];
    else all[groupId] = data;
    saveCustomAll(all);
}

// ── Built-in lists ───────────────────
const BUILTIN_WORDS = [
    'gandu', 'madarchod', 'bhosdike', 'bsdk', 'fucker', 'bhosda', 'lauda', 'laude',
    'betichod', 'chutiya', 'jhant', 'randi', 'boobs', 'tits', 'nigga', 'fuck', 'dick',
    'bitch', 'bastard', 'asshole', 'lund', 'mc', 'lodu', 'benchod', 'shit', 'slut',
    'whore', 'cock', 'cunt', 'pussy', 'bhnchod', 'behenchod', 'kanjar', 'kanjri',
    'kutti', 'kutta', 'khanzir', 'khusra', 'hijra', 'harami', 'haramzada', 'haramzadi',
    'dalla', 'dalli', 'beghairat', 'begairat', 'lota', 'chawla', 'lun', 'lan', 'lann',
    'luli', 'tatta', 'tatte', 'fck', 'fuk', 'btch', 'bc',
];

const BUILTIN_PHRASES = [
    'maa ki chut', 'behen ki chut', 'teri ma ki chut', 'teri maa ki', 'bhen chod',
    'behen chod', 'maa chod', 'ma chod', 'behn chod', 'lun le', 'lund le',
    'gandi nasal', 'gandi nasal ka', 'gandi aulaad', 'gandi aulad', 'kutti nasal',
    'harami nasal', 'kanjar nasal', 'gandi zat', 'kameeni nasal', 'randi ki aulad',
    'randi ka bacha', 'kutti ka bacha', 'kutte ki nasal',
];

// Compile cache per group
const _compiled = new Map();

function compiledFor(groupId) {
    const cached = _compiled.get(groupId);
    if (cached) return cached;

    const custom = getCustom(groupId);
    const words = new Set([...BUILTIN_WORDS, ...custom.words]);
    const phrases = [...BUILTIN_PHRASES, ...custom.phrases];

    const built = { words, phrases };
    _compiled.set(groupId, built);
    return built;
}

function invalidate(groupId) {
    _compiled.delete(groupId);
}

// ── Utils ───────────────────
function cleanText(t) {
    return (t || '')
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function parseItems(raw) {
    return (raw || '')
        .split(/[,\n]/)
        .map(s => cleanText(s))
        .filter(Boolean)
        .filter(s => s.length > 1);
}

function mention(senderId) {
    return '@' + senderId.split('@')[0];
}

async function canManage(sock, chatId, senderId) {
    if (typeof isOwnerOrSudo === 'function') {
        try { if (await isOwnerOrSudo(senderId, sock)) return true; } catch { }
    }
    try {
        const { isSenderAdmin } = await isAdmin(sock, chatId, senderId);
        return !!isSenderAdmin;
    } catch { return false; }
}

function helpText() {
    return [
        '*🛡️ ANTIBADWORD*',
        '',
        '*$antibadword on* — enable',
        '*$antibadword off* — disable',
        '*$antibadword set delete|kick|warn* — action',
        '',
        '*$antibadword add <word1, word2>* — add custom',
        '*$antibadword remove <word1, word2>* — remove custom',
        '*$antibadword list [page]* — see full list',
        '*$antibadword clear* — remove all custom',
        '*$antibadword test <sentence>* — test a sentence',
        '',
        '💡 Multi-word phrases comma se alag karo:',
        '_$antibadword add maa ki chut, teri maa ki_',
        '',
        '_M-KING_ ⚡',
    ].join('\n');
}

// ── Command ───────────────────
async function handleAntiBadwordCommand(sock, chatId, message, match) {
    const arg = (match || '').trim().toLowerCase();
    const sub = arg.split(/\s+/)[0];
    const rest = arg.slice(sub.length).trim();

    if (!chatId.endsWith('@g.us')) {
        return sock.sendMessage(chatId, { text: '🛡️ Antibadword sirf group mein chalta hai.\n\n_M-KING_ ⚡' }, { quoted: message });
    }

    const senderId = message.key.participant || message.key.remoteJid;

    if (!arg) {
        return sock.sendMessage(chatId, { text: helpText() }, { quoted: message });
    }

    // read-only commands kisi bhi member ke liye
    if (!['list', 'test'].includes(sub)) {
        if (!(await canManage(sock, chatId, senderId))) {
            return sock.sendMessage(chatId, {
                text: '⛔ Sirf admin/owner ye command chala sakta hai.\n\n_M-KING_ ⚡'
            }, { quoted: message });
        }
    }

    // ── on ──
    if (sub === 'on') {
        const cfg = await getAntiBadword(chatId);
        if (cfg?.enabled) return sock.sendMessage(chatId, { text: '✅ Pehle se enabled hai.\n\n_M-KING_ ⚡' }, { quoted: message });
        await setAntiBadword(chatId, 'on', cfg?.action || 'delete');
        invalidate(chatId);
        return sock.sendMessage(chatId, { text: '✅ *Antibadword ON*\nAction: ' + (cfg?.action || 'delete') + '\n\n_M-KING_ ⚡' }, { quoted: message });
    }

    // ── off ──
    if (sub === 'off') {
        const cfg = await getAntiBadword(chatId);
        if (!cfg?.enabled) return sock.sendMessage(chatId, { text: '⚠️ Pehle se off hai.\n\n_M-KING_ ⚡' }, { quoted: message });
        await removeAntiBadword(chatId);
        return sock.sendMessage(chatId, { text: '🚫 *Antibadword OFF*\n\n_M-KING_ ⚡' }, { quoted: message });
    }

    // ── set ──
    if (sub === 'set') {
        const action = rest;
        if (!['delete', 'kick', 'warn'].includes(action)) {
            return sock.sendMessage(chatId, { text: '❌ Action sirf: *delete*, *kick*, *warn*\n\n_M-KING_ ⚡' }, { quoted: message });
        }
        const cfg = await getAntiBadword(chatId);
        await setAntiBadword(chatId, cfg?.enabled ? 'on' : 'off', action);
        return sock.sendMessage(chatId, { text: `✅ Action set: *${action}*` + (cfg?.enabled ? '' : '\n_(antibadword off hai, on karo)_') + '\n\n_M-KING_ ⚡' }, { quoted: message });
    }

    // ── add ──
    if (sub === 'add') {
        const items = parseItems(rest);
        if (!items.length) return sock.sendMessage(chatId, { text: '❌ Kuch do: *$antibadword add gali1, gali2*\n\n_M-KING_ ⚡' }, { quoted: message });

        const cur = getCustom(chatId);
        const added = [], skipped = [];

        for (const it of items) {
            const isPhrase = it.includes(' ');
            const bucket = isPhrase ? cur.phrases : cur.words;
            const other = isPhrase ? cur.words : cur.phrases;

            if (bucket.includes(it) || other.includes(it)) { skipped.push(it); continue; }
            if (BUILTIN_WORDS.includes(it) || BUILTIN_PHRASES.includes(it)) { skipped.push(it); continue; }
            if (cur.words.length + cur.phrases.length >= MAX_CUSTOM) { skipped.push(it + ' (limit)'); continue; }

            bucket.push(it);
            added.push(it);
        }

        setCustom(chatId, cur);
        invalidate(chatId);

        const lines = [`🛡️ *ANTIBADWORD — ADD*`, ''];
        if (added.length) lines.push(`✅ Added (${added.length}):\n${added.map(w => '• ' + w).join('\n')}`);
        if (skipped.length) lines.push(`\n⚠️ Skipped (${skipped.length}):\n${skipped.map(w => '• ' + w).join('\n')}`);
        lines.push(`\n📊 Custom total: *${cur.words.length + cur.phrases.length}/${MAX_CUSTOM}*`, '', '_M-KING_ ⚡');

        return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: message });
    }

    // ── remove / del ──
    if (sub === 'remove' || sub === 'del' || sub === 'deleteword') {
        const items = parseItems(rest);
        if (!items.length) return sock.sendMessage(chatId, { text: '❌ Kuch do: *$antibadword remove gali1, gali2*\n\n_M-KING_ ⚡' }, { quoted: message });

        const cur = getCustom(chatId);
        const removed = [], missing = [];

        for (const it of items) {
            let hit = false;
            for (const key of ['words', 'phrases']) {
                const idx = cur[key].indexOf(it);
                if (idx !== -1) { cur[key].splice(idx, 1); hit = true; }
            }
            if (hit) removed.push(it);
            else missing.push(it);
        }

        setCustom(chatId, cur);
        invalidate(chatId);

        const lines = [`🗑️ *ANTIBADWORD — REMOVE*`, ''];
        if (removed.length) lines.push(`✅ Removed (${removed.length}):\n${removed.map(w => '• ' + w).join('\n')}`);
        if (missing.length) {
            lines.push(`\n⚠️ Custom mein nahi mila (${missing.length}):\n${missing.map(w => '• ' + w).join('\n')}`);
            const builtinHits = missing.filter(w => BUILTIN_WORDS.includes(w) || BUILTIN_PHRASES.includes(w));
            if (builtinHits.length) lines.push(`\n_Note: ye built-in hain, hatane ke liye list se check karo._`);
        }
        lines.push('', '_M-KING_ ⚡');

        return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: message });
    }

    // ── clear ──
    if (sub === 'clear' || sub === 'reset') {
        const cur = getCustom(chatId);
        const total = cur.words.length + cur.phrases.length;
        if (!total) return sock.sendMessage(chatId, { text: '⚠️ Koi custom word nahi hai.\n\n_M-KING_ ⚡' }, { quoted: message });
        setCustom(chatId, { words: [], phrases: [] });
        invalidate(chatId);
        return sock.sendMessage(chatId, { text: `🧹 *${total} custom words hata diye.*\nBuilt-in list waisi hi hai.\n\n_M-KING_ ⚡` }, { quoted: message });
    }

    // ── list ──
    if (sub === 'list') {
        const page = Math.max(1, parseInt(rest, 10) || 1);
        const cur = getCustom(chatId);

        const all = [
            ...cur.words.map(w => ({ w, c: 'custom' })),
            ...cur.phrases.map(w => ({ w, c: 'custom' })),
            ...BUILTIN_WORDS.map(w => ({ w, c: 'builtin' })),
            ...BUILTIN_PHRASES.map(w => ({ w, c: 'builtin' })),
        ];

        const pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
        const p = Math.min(page, pages);
        const slice = all.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE);

        const lines = [
            `📋 *ANTIBADWORD LIST*`,
            `Total: *${all.length}*  (custom: ${cur.words.length + cur.phrases.length})`,
            `Page *${p}/${pages}*`,
            '',
        ];

        let lastType = null;
        for (const item of slice) {
            if (item.c !== lastType) {
                lines.push(item.c === 'custom' ? '— *CUSTOM* —' : '— *BUILT-IN* —');
                lastType = item.c;
            }
            lines.push((item.c === 'custom' ? '🔹 ' : '• ') + item.w);
        }

        if (p < pages) lines.push(`\n➡️ Agla page: *$antibadword list ${p + 1}*`);
        lines.push('', '_M-KING_ ⚡');

        return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: message });
    }

    // ── test ──
    if (sub === 'test') {
        if (!rest) return sock.sendMessage(chatId, { text: '❌ Sentence do: *$antibadword test teri ma ki chut*\n\n_M-KING_ ⚡' }, { quoted: message });

        const { words, phrases } = compiledFor(chatId);
        const clean = cleanText(rest);
        const tokens = clean.split(' ');
        const found = new Set();

        for (const t of tokens) if (words.has(t)) found.add(t);
        for (const ph of phrases) if (clean.includes(ph)) found.add(ph);

        if (!found.size) {
            return sock.sendMessage(chatId, { text: `✅ *Clean hai*\n_${rest}_\n\n_M-KING_ ⚡` }, { quoted: message });
        }

        return sock.sendMessage(chatId, {
            text: `🚫 *Bad word mila!*\n\nMatched: ${[...found].map(w => '• ' + w).join('\n')}\n\n_${rest}_\n\n_M-KING_ ⚡`
        }, { quoted: message });
    }

    return sock.sendMessage(chatId, { text: helpText() }, { quoted: message });
}

// ── Detection ───────────────────
async function handleBadwordDetection(sock, chatId, message, userMessage, senderId) {
    if (!chatId.endsWith('@g.us')) return;
    if (message.key.fromMe) return;
    if (!userMessage) return;
    if (/^[.$]/.test(userMessage)) return;

    const cfg = await getAntiBadword(chatId);
    if (!cfg?.enabled) return;

    const clean = cleanText(userMessage);
    if (!clean) return;

    const { words, phrases } = compiledFor(chatId);

    let matched = false;
    for (const t of clean.split(' ')) {
        if (t.length < 2) continue;
        if (words.has(t)) { matched = true; break; }
    }
    if (!matched) {
        for (const ph of phrases) {
            if (clean.includes(ph)) { matched = true; break; }
        }
    }
    if (!matched) return;

    const { isBotAdmin, isSenderAdmin } = await isAdmin(sock, chatId, senderId);
    const tag = mention(senderId);
    const action = cfg.action || 'delete';

    if (!isBotAdmin) {
        return sock.sendMessage(chatId, {
            text: `⚠️ ${tag} bad word — _bot admin nahi hai_`,
            mentions: [senderId],
        });
    }

    try { await sock.sendMessage(chatId, { delete: message.key }); } catch { }

    if (action === 'delete') {
        return sock.sendMessage(chatId, { text: `🚫 ${tag} bad word not allowed`, mentions: [senderId] });
    }

    if (action === 'kick') {
        if (isSenderAdmin) {
            return sock.sendMessage(chatId, { text: `⚠️ ${tag} admin hai, kick nahi kiya`, mentions: [senderId] });
        }
        try {
            await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');
            return sock.sendMessage(chatId, { text: `🚫 ${tag} kicked — bad word`, mentions: [senderId] });
        } catch {
            return sock.sendMessage(chatId, { text: `⚠️ Kick fail hua`, mentions: [senderId] });
        }
    }

    if (action === 'warn') {
        const count = await incrementWarningCount(chatId, senderId);
        if (count >= 3 && !isSenderAdmin) {
            try {
                await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');
                await resetWarningCount(chatId, senderId);
                return sock.sendMessage(chatId, { text: `🚫 ${tag} 3 warnings ke baad kicked`, mentions: [senderId] });
            } catch {
                return sock.sendMessage(chatId, { text: `⚠️ ${tag} warning ${count}/3`, mentions: [senderId] });
            }
        }
        return sock.sendMessage(chatId, { text: `⚠️ ${tag} warning ${count}/3 — bad word`, mentions: [senderId] });
    }
}

module.exports = { handleAntiBadwordCommand, handleBadwordDetection };
