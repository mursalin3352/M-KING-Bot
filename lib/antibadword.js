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

// ── Custom words storage ───────────────────
const CUSTOM_PATH = path.join(__dirname, '../data/antibadword_custom.json');
const MAX_CUSTOM = 300;
const PAGE_SIZE = 60;

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
function cleanText(t) {
    return (t || '').toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseItems(raw) {
    return (raw || '').split(/[,\n]/).map(cleanText).filter(s => s && s.length > 1);
}

const tagOf = (id) => '@' + String(id).split('@')[0];

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
        '*🛡️ ANTIBADWORD*', '',
        '*$antibadword on* — enable',
        '*$antibadword off* — disable',
        '*$antibadword set delete|kick|warn* — action', '',
        '*$antibadword add <word1, word2>* — add custom',
        '*$antibadword remove <word1, word2>* — remove custom',
        '*$antibadword list [page]* — see full list',
        '*$antibadword clear* — remove all custom',
        '*$antibadword test <sentence>* — test a sentence', '',
        '💡 Phrase comma se alag karo:',
        '_$antibadword add teri maa ki, gandi nasal_', '',
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
        if (!ok) {
            return sock.sendMessage(chatId, { text: '⛔ Sirf admin/owner.\n\n_M-KING_ ⚡' }, { quoted: message });
        }
    }

    if (sub === 'on') {
        const cfg = await readCfg(chatId);
        if (cfg?.enabled) return sock.sendMessage(chatId, { text: '✅ Pehle se enabled.\n\n_M-KING_ ⚡' }, { quoted: message });
        await setAntiBadword(chatId, 'on', cfg?.action || 'delete');
        invalidate(chatId);
        return sock.sendMessage(chatId, { text: `✅ *Antibadword ON*\nAction: ${cfg?.action || 'delete'}\n\n_M-KING_ ⚡` }, { quoted: message });
    }

    if (sub === 'off') {
        const cfg = await readCfg(chatId);
        if (!cfg?.enabled) return sock.sendMessage(chatId, { text: '⚠️ Pehle se off hai.\n\n_M-KING_ ⚡' }, { quoted: message });
        await removeAntiBadword(chatId);
        return sock.sendMessage(chatId, { text: '🚫 *Antibadword OFF*\n\n_M-KING_ ⚡' }, { quoted: message });
    }

    if (sub === 'set') {
        if (!['delete', 'kick', 'warn'].includes(rest)) {
            return sock.sendMessage(chatId, { text: '❌ Action sirf: *delete*, *kick*, *warn*\n\n_M-KING_ ⚡' }, { quoted: message });
        }
        const cfg = await readCfg(chatId);
        await setAntiBadword(chatId, cfg?.enabled ? 'on' : 'off', rest);
        return sock.sendMessage(chatId, {
            text: `✅ Action set: *${rest}*` + (cfg?.enabled ? '' : '\n_(antibadword off hai)_') + '\n\n_M-KING_ ⚡'
        }, { quoted: message });
    }

    if (sub === 'add') {
        const items = parseItems(rest);
        if (!items.length) return sock.sendMessage(chatId, { text: '❌ *$antibadword add gali1, gali2*\n\n_M-KING_ ⚡' }, { quoted: message });

        const cur = getCustom(chatId);
        const added = [], skipped = [];

        for (const it of items) {
            const isPhrase = it.includes(' ');
            const bucket = isPhrase ? cur.phrases : cur.words;
            const other = isPhrase ? cur.words : cur.phrases;

            if (bucket.includes(it) || other.includes(it)) { skipped.push(it + ' (already)'); continue; }
            if (BUILTIN_WORDS.includes(it) || BUILTIN_PHRASES.includes(it)) { skipped.push(it + ' (built-in)'); continue; }
            if (cur.words.length + cur.phrases.length >= MAX_CUSTOM) { skipped.push(it + ' (limit)'); continue; }

            bucket.push(it);
            added.push(it);
        }

        setCustom(chatId, cur);
        invalidate(chatId);

        const lines = ['🛡️ *ADD*', ''];
        if (added.length) lines.push(`✅ Added (${added.length}):\n${added.map(w => '• ' + w).join('\n')}`);
        if (skipped.length) lines.push(`\n⚠️ Skipped (${skipped.length}):\n${skipped.map(w => '• ' + w).join('\n')}`);
        lines.push(`\n📊 Custom: *${cur.words.length + cur.phrases.length}/${MAX_CUSTOM}*`, '', '_M-KING_ ⚡');

        return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: message });
    }

    if (sub === 'remove' || sub === 'del' || sub === 'deleteword') {
        const items = parseItems(rest);
        if (!items.length) return sock.sendMessage(chatId, { text: '❌ *$antibadword remove gali1, gali2*\n\n_M-KING_ ⚡' }, { quoted: message });

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

        const lines = ['🗑️ *REMOVE*', ''];
        if (removed.length) lines.push(`✅ Removed (${removed.length}):\n${removed.map(w => '• ' + w).join('\n')}`);
        if (missing.length) {
            lines.push(`\n⚠️ Custom mein nahi mila (${missing.length}):\n${missing.map(w => '• ' + w).join('\n')}`);
            if (missing.some(w => BUILTIN_WORDS.includes(w) || BUILTIN_PHRASES.includes(w))) {
                lines.push('\n_Note: ye built-in hain._');
            }
        }
        lines.push('', '_M-KING_ ⚡');

        return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: message });
    }

    if (sub === 'clear' || sub === 'reset') {
        const cur = getCustom(chatId);
        const total = cur.words.length + cur.phrases.length;
        if (!total) return sock.sendMessage(chatId, { text: '⚠️ Koi custom word nahi.\n\n_M-KING_ ⚡' }, { quoted: message });
        setCustom(chatId, { words: [], phrases: [] });
        invalidate(chatId);
        return sock.sendMessage(chatId, { text: `🧹 *${total} custom words hata diye.*\nBuilt-in list waisi hai.\n\n_M-KING_ ⚡` }, { quoted: message });
    }

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
            `Total *${all.length}* (custom: ${cur.words.length + cur.phrases.length})`,
            `Page *${p}/${pages}*`, '',
        ];

        let last = null;
        for (const it of slice) {
            if (it.c !== last) { lines.push(it.c === 'custom' ? '— *CUSTOM* —' : '— *BUILT-IN* —'); last = it.c; }
            lines.push((it.c === 'custom' ? '🔹 ' : '• ') + it.w);
        }

        if (p < pages) lines.push(`\n➡️ *$antibadword list ${p + 1}*`);
        lines.push('', '_M-KING_ ⚡');

        return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: message });
    }

    if (sub === 'test') {
        if (!rest) return sock.sendMessage(chatId, { text: '❌ *$antibadword test teri ma ki chut*\n\n_M-KING_ ⚡' }, { quoted: message });

        const { words, phrases } = compiledFor(chatId);
        const clean = cleanText(rest);
        const found = new Set();

        for (const t of clean.split(' ')) if (words.has(t)) found.add(t);
        for (const ph of phrases) if (clean.includes(ph)) found.add(ph);

        if (!found.size) return sock.sendMessage(chatId, { text: `✅ *Clean*\n_${rest}_\n\n_M-KING_ ⚡` }, { quoted: message });

        return sock.sendMessage(chatId, {
            text: `🚫 *Bad word mila!*\n\n${[...found].map(w => '• ' + w).join('\n')}\n\n_${rest}_\n\n_M-KING_ ⚡`
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
