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

// ── Storage ───────────────────
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
    } catch { }
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

// ── Built-in ───────────────────
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

// ── Utils ───────────────────
const cleanText = (t) => (t || '').toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
const parseItems = (raw) => (raw || '').split(/[,\n]/).map(cleanText).filter(s => s && s.length > 1);
const tagOf = (id) => '@' + String(id).split('@')[0];

// comma-joined + wrapping
function wrapItems(items) {
    const lines = [];
    let cur = '';
    for (const it of items) {
        const piece = cur ? ', ' + it : it;
        if (cur && (cur.length + piece.length) > WRAP) { lines.push(cur + ','); cur = it; }
        else cur += piece;
    }
    if (cur) lines.push(cur);
    return lines.join('\n');
}

async function readCfg(chatId) {
    try { return await getAntiBadword(chatId); } catch { }
    try { return await getAntiBadword(chatId, 'on'); } catch { }
    return null;
}

async function canManage(sock, chatId, senderId) {
    if (typeof isOwnerOrSudo === 'function') {
        try { if (await isOwnerOrSudo(senderId, sock)) return true; } catch { }
    }
    try {
        const r = await isAdmin(sock, chatId, senderId);
        return !!r?.isSenderAdmin;
    } catch { return false; }
}

function helpText() {
    return [
        '🛡️ *ANTIBADWORD*',
        '',
        '*TOGGLE*',
        '`$antibadword on` — enable',
        '`$antibadword off` — disable',
        '`$antibadword set delete|kick|warn` — action',
        '',
        '*MANAGE*',
        '`$antibadword add <word1, word2>` — add custom',
        '`$antibadword remove <word1, word2>` — remove custom',
        '`$antibadword list [page]` — full list',
        '`$antibadword clear` — remove all custom',
        '`$antibadword test <sentence>` — test',
        '',
        '_Phrase comma se alag karo:_',
        '`$antibadword add teri maa ki, gandi nasal`',
        '',
        '_M-KING_ ⚡',
    ].join('\n');
}

// ── Command ───────────────────
async function handleAntiBadwordCommand(sock, chatId, message, match, senderIdArg, isSenderAdminArg) {
    const arg = (match || '').trim().toLowerCase();
    const sub = arg.split(/\s+/)[0];
    const rest = arg.slice(sub.length).trim();
    const senderId = senderIdArg || message.key.participant || message.key.remoteJid;

    if (!chatId.endsWith('@g.us')) {
        return sock.sendMessage(chatId, { text: '🛡️ Antibadword sirf group mein chalta hai.\n\n_M-KING_ ⚡' }, { quoted: message });
    }

    if (!arg) return sock.sendMessage(chatId, { text: helpText() }, { quoted: message });

    const isPublic = ['list', 'test'].includes(sub);
    if (!isPublic) {
        const ok = (typeof isSenderAdminArg === 'boolean' && isSenderAdminArg)
            ? true
            : await canManage(sock, chatId, senderId);
        if (!ok) return sock.sendMessage(chatId, { text: '⛔ Sirf admin/owner.\n\n_M-KING_ ⚡' }, { quoted: message });
    }

    // ── on ──
if (sub === 'on') {
    const cfg = await readCfg(chatId);
    if (cfg?.enabled) return sock.sendMessage(chatId, { text: '✅ Pehle se enabled.\n\n_M-KING_ ⚡' }, { quoted: message });
    const act = cfg?.action || 'delete';
    await setAntiBadword(chatId, 'on', act);
    invalidate(chatId);
    _compiled.delete(chatId); // extra clear
    return sock.sendMessage(chatId, {
        text: ['🛡️ *ANTIBADWORD ON*', '', `*Action:* ${act}`, `*Single:* ${BUILTIN_WORDS.length}`, `*Phrases:* ${BUILTIN_PHRASES.length}`, '', '_M-KING_ ⚡'].join('\n')
    }, { quoted: message });
}

// ── off ──
if (sub === 'off') {
    const cfg = await readCfg(chatId);
    if (!cfg?.enabled) return sock.sendMessage(chatId, { text: '⚠️ Pehle se off hai.\n\n_M-KING_ ⚡' }, { quoted: message });
    await removeAntiBadword(chatId);
    invalidate(chatId); // <-- YE LINE ADD KARO, SAB SE ZAROORI
    _compiled.delete(chatId);
    return sock.sendMessage(chatId, { text: '🚫 *ANTIBADWORD OFF*\n\n_M-KING_ ⚡' }, { quoted: message });
}

    // ── set ──
    if (sub === 'set') {
        if (!['delete', 'kick', 'warn'].includes(rest)) {
            return sock.sendMessage(chatId, { text: '❌ Action sirf: *delete*, *kick*, *warn*\n\n_M-KING_ ⚡' }, { quoted: message });
        }
        const cfg = await readCfg(chatId);
        await setAntiBadword(chatId, cfg?.enabled ? 'on' : 'off', rest);
        return sock.sendMessage(chatId, {
            text: `✅ *Action:* ${rest}` + (cfg?.enabled ? '' : '\n_antibadword off hai_') + '\n\n_M-KING_ ⚡'
        }, { quoted: message });
    }

    // ── add ──
    if (sub === 'add') {
        const items = parseItems(rest);
        if (!items.length) return sock.sendMessage(chatId, { text: '❌ `$antibadword add gali1, gali2`\n\n_M-KING_ ⚡' }, { quoted: message });

        const cur = getCustom(chatId);
        const added = [], skipped = [];

        for (const it of items) {
            const isPhrase = it.includes(' ');
            const bucket = isPhrase ? cur.phrases : cur.words;
            const other = isPhrase ? cur.words : cur.phrases;

            if (bucket.includes(it) || other.includes(it)) { skipped.push(it); continue; }
            if (BUILTIN_WORDS.includes(it) || BUILTIN_PHRASES.includes(it)) { skipped.push(it); continue; }
            if (cur.words.length + cur.phrases.length >= MAX_CUSTOM) { skipped.push(it); continue; }

            bucket.push(it);
            added.push(it);
        }

        setCustom(chatId, cur);
        invalidate(chatId);

        const total = cur.words.length + cur.phrases.length;
        const lines = ['🛡️ *BAD WORDS — ADD*', ''];

        if (added.length) lines.push(`✅ *Added (${added.length})*`, wrapItems(added), '');
        if (skipped.length) lines.push(`⚠️ *Skipped (${skipped.length})*`, wrapItems(skipped), '');

        lines.push(`📊 *Custom:* ${total}/${MAX_CUSTOM}`, '_M-KING_ ⚡');
        return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: message });
    }

    // ── remove ──
    if (sub === 'remove' || sub === 'del' || sub === 'deleteword') {
        const items = parseItems(rest);
        if (!items.length) return sock.sendMessage(chatId, { text: '❌ `$antibadword remove gali1, gali2`\n\n_M-KING_ ⚡' }, { quoted: message });

        const cur = getCustom(chatId);
        const removed = [], missing = [];

        for (const it of items) {
            let hit = false;
            for (const k of ['words', 'phrases']) {
                const i = cur[k].indexOf(it);
                if (i !== -1) { cur[k].splice(i, 1); hit = true; }
            }
            hit ? removed.push(it) : missing.push(it);
        }

        setCustom(chatId, cur);
        invalidate(chatId);

        const total = cur.words.length + cur.phrases.length;
        const lines = ['🗑️ *BAD WORDS — REMOVE*', ''];

        if (removed.length) lines.push(`✅ *Removed (${removed.length})*`, wrapItems(removed), '');
        if (missing.length) {
            lines.push(`⚠️ *Not in custom (${missing.length})*`, wrapItems(missing));
            if (missing.some(w => BUILTIN_WORDS.includes(w) || BUILTIN_PHRASES.includes(w))) {
                lines.push('_ye built-in hain_');
            }
            lines.push('');
        }

        lines.push(`📊 *Custom:* ${total}/${MAX_CUSTOM}`, '_M-KING_ ⚡');
        return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: message });
    }

    // ── clear ──
    if (sub === 'clear' || sub === 'reset') {
        const cur = getCustom(chatId);
        const total = cur.words.length + cur.phrases.length;
        if (!total) return sock.sendMessage(chatId, { text: '⚠️ Koi custom word nahi.\n\n_M-KING_ ⚡' }, { quoted: message });
        setCustom(chatId, { words: [], phrases: [] });
        invalidate(chatId);
        return sock.sendMessage(chatId, {
            text: `🧹 *${total} custom words hata diye*\n_Built-in list waisi hai_\n\n_M-KING_ ⚡`
        }, { quoted: message });
    }

    // ── list ──
    if (sub === 'list') {
        const cur = getCustom(chatId);
        const customSet = new Set([...cur.words, ...cur.phrases]);

        const singles = [...cur.words, ...BUILTIN_WORDS.filter(w => !cur.words.includes(w))];
        const phrases = [...cur.phrases, ...BUILTIN_PHRASES.filter(p => !cur.phrases.includes(p))];
        const total = singles.length + phrases.length;

        const perPage = PAGE_ITEMS;
        const pages = Math.max(1, Math.ceil(total / perPage));
        const p = Math.min(Math.max(1, parseInt(rest, 10) || 1), pages);

        const start = (p - 1) * perPage;
        const sSlice = singles.slice(start, start + perPage);
        const pStart = Math.max(0, start - singles.length);
        const pSlice = pStart < perPage ? phrases.slice(pStart, pStart + perPage) : [];

        const mark = (w) => (customSet.has(w) ? '+' + w : w);

        const lines = ['🛡️ *BAD WORDS LIST*', `*Total:* ${total}`, ''];

        if (sSlice.length) lines.push(`*Single (${singles.length}):*`, wrapItems(sSlice.map(mark)), '');
        if (pSlice.length) lines.push(`*Phrases (${phrases.length}):*`, wrapItems(pSlice.map(mark)), '');

        if (customSet.size) lines.push('_+ = custom_', '');
        lines.push(p < pages ? `📄 *Page ${p}/${pages}* → \`$antibadword list ${p + 1}\`` : `📄 *Page ${p}/${pages}*`, '_M-KING_ ⚡');

        return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: message });
    }

    // ── test ──
    if (sub === 'test') {
        if (!rest) return sock.sendMessage(chatId, { text: '❌ `$antibadword test teri ma ki chut`\n\n_M-KING_ ⚡' }, { quoted: message });

        const { words, phrases } = compiledFor(chatId);
        const clean = cleanText(rest);
        const found = new Set();

        for (const t of clean.split(' ')) if (words.has(t)) found.add(t);
        for (const ph of phrases) if (clean.includes(ph)) found.add(ph);

        if (!found.size) {
            return sock.sendMessage(chatId, { text: `✅ *CLEAN*\n_${rest}_\n\n_M-KING_ ⚡` }, { quoted: message });
        }

        return sock.sendMessage(chatId, {
            text: [`🚫 *BAD WORD FOUND*`, '', `*Matched (${found.size}):*`, wrapItems([...found]), '', `_${rest}_`, '', '_M-KING_ ⚡'].join('\n')
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

    const cfg = await readCfg(chatId);
    if (!cfg?.enabled) return;

    const clean = cleanText(userMessage);
    if (!clean) return;

    const { words, phrases } = compiledFor(chatId);
    let matched = false;

    for (const t of clean.split(' ')) {
        if (t.length < 2) continue;
        if (words.has(t)) { matched = true; break; }
    }
    if (!matched) for (const ph of phrases) if (clean.includes(ph)) { matched = true; break; }
    if (!matched) return;

    const sender = senderId || message.key.participant;
    const { isBotAdmin, isSenderAdmin } = await isAdmin(sock, chatId, sender);
    const tag = tagOf(sender);
    const action = cfg.action || 'delete';

    if (!isBotAdmin) {
        return sock.sendMessage(chatId, { text: `⚠️ ${tag} bad word — _bot admin nahi_`, mentions: [sender] });
    }

    try { await sock.sendMessage(chatId, { delete: message.key }); } catch { }

    if (action === 'delete') {
        return sock.sendMessage(chatId, { text: `🚫 ${tag} bad word not allowed`, mentions: [sender] });
    }

    if (action === 'kick') {
        if (isSenderAdmin) return sock.sendMessage(chatId, { text: `⚠️ ${tag} admin hai, kick nahi kiya`, mentions: [sender] });
        try {
            await sock.groupParticipantsUpdate(chatId, [sender], 'remove');
            return sock.sendMessage(chatId, { text: `🚫 ${tag} kicked — bad word`, mentions: [sender] });
        } catch {
            return sock.sendMessage(chatId, { text: '⚠️ Kick fail hua', mentions: [sender] });
        }
    }

    if (action === 'warn') {
        const count = await incrementWarningCount(chatId, sender);
        if (count >= 3 && !isSenderAdmin) {
            try {
                await sock.groupParticipantsUpdate(chatId, [sender], 'remove');
                await resetWarningCount(chatId, sender);
                return sock.sendMessage(chatId, { text: `🚫 ${tag} 3 warnings ke baad kicked`, mentions: [sender] });
            } catch {
                return sock.sendMessage(chatId, { text: `⚠️ ${tag} warning ${count}/3`, mentions: [sender] });
            }
        }
        return sock.sendMessage(chatId, { text: `⚠️ ${tag} warning ${count}/3 — bad word`, mentions: [sender] });
    }
}

module.exports = { handleAntiBadwordCommand, handleBadwordDetection };
