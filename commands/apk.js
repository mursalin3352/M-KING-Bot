'use strict';
const axios = require('axios');

const API = 'https://api.omegatech.app';
const CDN = 'https://apkmody.mobi';
const FOOT = '𝗠-𝗞𝗜𝗡𝗚👑';
const MAX_DOC = 95 * 1024 * 1024;

const HDR = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Referer': API + '/',
};

const abs = (u) => (!u ? null : u.startsWith('/') ? CDN + u : u);
const mb = (b) => (b ? (b / 1048576).toFixed(1) + ' MB' : 'Unknown');
const clean = (s) => String(s || '').replace(/[\\/:*?"<>|]+/g, '').slice(0, 70).trim();

// ── Low level GET ───────────────────
async function apiGet(path, params, timeout) {
    const res = await axios.get(API + path, {
        params,
        timeout: timeout || 12000,
        headers: HDR,
        validateStatus: null,
    });
    const b = res.data;
    if (!b || typeof b !== 'object') throw new Error('bad response');
    if (b.success === false || (b.statusCode && b.statusCode >= 400)) {
        throw new Error(b.error || ('HTTP ' + b.statusCode));
    }
    return b.data !== undefined ? b.data : b;
}

// ── Provider 1: apkmody ───────────────────
async function mSearch(q) {
    const d = await apiGet('/api/download/apkmody', { action: 'search', query: q }, 12000);
    const items = Array.isArray(d?.items) ? d.items : [];
    return items.map(it => ({
        title: it.title || '',
        version: it.version || '',
        url: it.url || '',
        cover: abs(it.cover),
    })).filter(it => it.title && it.url);
}

async function mDetail(url) {
    const d = await apiGet('/api/download/apkmody', { action: 'detail', url }, 15000);
    const dl = Array.isArray(d?.downloads) ? d.downloads[0] : null;
    return {
        title: d?.title,
        version: d?.version,
        mod: d?.mod,
        pkg: d?.package,
        icon: abs(d?.icon),
        file: dl ? { url: dl.url, name: dl.fileName, size: dl.size, bytes: dl.sizeBytes } : null,
    };
}

// ── Provider 2: apk4free (backup) ───────────────────
async function aSearch(q) {
    const d = await apiGet('/api/Search/apk4free', { q }, 12000);
    const raw = d?.items || d?.results || d?.apps || (Array.isArray(d) ? d : []);
    return raw.map(it => ({
        title: it.title || it.name || it.appname || '',
        version: it.version || '',
        url: it.url || it.link || it.detail_url || '',
        cover: abs(it.icon || it.cover || it.image),
    })).filter(it => it.title);
}

async function aDetail(item) {
    const key = item.url || item.title;
    let d = null;
    for (const p of ['url', 'link', 'q']) {
        try { d = await apiGet('/api/download/apk4free-detail', { [p]: key }, 15000); break; } catch { }
    }
    if (!d) throw new Error('apk4free detail failed');
    const dl = d?.download_url || d?.downloadUrl || d?.url;
    if (!dl) throw new Error('no apk link');
    return {
        title: d?.appname || d?.title || item.title,
        version: d?.version || item.version,
        mod: d?.mod,
        pkg: d?.package || d?.package_name,
        icon: abs(d?.appicon || d?.icon || item.cover),
        file: { url: dl, name: d?.filename, size: d?.size, bytes: d?.size_bytes },
    };
}

// ── Unified resolve ───────────────────
async function resolve(query, pickIdx) {
    const errs = [];

    // 1) apkmody
    try {
        const items = await mSearch(query);
        if (items.length) {
            const chosen = pickIdx ? (items[pickIdx - 1] || items[0]) : best(items, query);
            const info = await mDetail(chosen.url);
            if (info.file?.url) return { info, items };
            errs.push('apkmody: no link');
        } else errs.push('apkmody: 0 results');
    } catch (e) { errs.push('apkmody: ' + e.message); }

    // 2) apk4free
    try {
        const items = await aSearch(query);
        if (items.length) {
            const chosen = pickIdx ? (items[pickIdx - 1] || items[0]) : best(items, query);
            const info = await aDetail(chosen);
            if (info.file?.url) return { info, items };
            errs.push('apk4free: no link');
        } else errs.push('apk4free: 0 results');
    } catch (e) { errs.push('apk4free: ' + e.message); }

    const err = new Error(errs.join(' | '));
    err.soft = true;
    throw err;
}

function best(items, q) {
    const ql = q.toLowerCase();
    let best = items[0], bs = -1;
    items.forEach((it, i) => {
        const t = (it.title || '').toLowerCase();
        let s = 0;
        if (t === ql) s = 100;
        else if (t.startsWith(ql)) s = 70;
        else if (t.includes(ql)) s = 50;
        else if (ql.includes(t) && t.length > 2) s = 30;
        s -= i * 0.4;
        if (s > bs) { bs = s; best = it; }
    });
    return best;
}

// ── Image validate ───────────────────
async function fetchIcon(url) {
    if (!url) return null;
    try {
        const r = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 10000,
            maxRedirects: 5,
            headers: { 'User-Agent': HDR['User-Agent'], 'Accept': 'image/*' },
            validateStatus: null,
        });
        const ct = String(r.headers?.['content-type'] || '');
        if (r.status === 200 && ct.includes('image') && r.data?.byteLength > 500) return Buffer.from(r.data);
    } catch { }
    return null;
}

// ── Command ───────────────────
async function apkCommand(sock, chatId, message) {
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    let raw = text.replace(/^\S+\s*/, '').trim();

    if (!raw) {
        return sock.sendMessage(chatId, {
            text: [
                '╭━━━「 📲 𝐀𝐏𝐊 」━━━',
                '┃',
                '┃ `$apk <app name>` — download',
                '┃ `$apk list <app name>` — 10 results',
                '┃ `$apk 2 <app name>` — 2nd result',
                '┃',
                '┃ _Example: $apk WhatsApp_',
                '┃',
                '╰━━━━━━━━━━━━━━━━━━━━━',
                '',
                FOOT,
            ].join('\n')
        }, { quoted: message });
    }

    let listMode = false;
    let pick = 0;

    if (/^(list|-l|search)\s+/i.test(raw)) {
        listMode = true;
        raw = raw.replace(/^(list|-l|search)\s+/i, '').trim();
    } else {
        const m = raw.match(/^(\d{1,2})\s+(.+)$/);
        if (m) { pick = parseInt(m[1], 10); raw = m[2].trim(); }
    }

    const query = raw;
    if (!query) return sock.sendMessage(chatId, { text: `❌ App ka naam do.\n\n${FOOT}` }, { quoted: message });

    try {
        await sock.sendMessage(chatId, { text: `📲 Searching APK: *${query}*...\n\n${FOOT}` }, { quoted: message });

        if (listMode) {
            let items = [];
            try { items = await mSearch(query); } catch { }
            if (!items.length) { try { items = await aSearch(query); } catch { } }

            if (!items.length) {
                return sock.sendMessage(chatId, { text: `🚫 *"${query}"* nahi mila.\n\n${FOOT}` }, { quoted: message });
            }

            const body = items.slice(0, 10).map((it, i) => `*${i + 1}.* ${it.title}\n   _${it.version || 'unknown'}_`).join('\n\n');

            return sock.sendMessage(chatId, {
                text: `╭━━━「 🔍 𝐑𝐄𝐒𝐔𝐋𝐓𝐒 」━━━\n┃\n${body}\n┃\n╰━━━━━━━━━━━━━━━━━━━━━\n\n_Pick: \`$apk <number> ${query}\`_\n\n${FOOT}`
            }, { quoted: message });
        }

        const { info } = await resolve(query, pick);
        const f = info.file;
        const sizeTxt = f.size || mb(f.bytes);
        const title = info.title || query;

        const caption =
            `╭━━━「 📦 𝐀𝐏𝐊 𝐅𝐎𝐔𝐍𝐃 」━━━\n` +
            `┃\n` +
            `┃ 📂 𝐀𝐩𝐩: ${title}\n` +
            `┃ 🏷️ 𝐕𝐞𝐫: ${info.version || 'Unknown'}\n` +
            `┃ 🧩 𝐌𝐨𝐝: ${info.mod || 'Original'}\n` +
            `┃ 📦 𝐒𝐢𝐳𝐞: ${sizeTxt}\n` +
            (info.pkg ? `┃ 🆔 ${info.pkg}\n` : '') +
            `┃\n` +
            `╰━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `⚠️ _Use at your own risk._\n\n${FOOT}`;

        const icon = await fetchIcon(info.icon);
        if (icon) {
            try { await sock.sendMessage(chatId, { image: icon, caption }, { quoted: message }); } catch { }
        }

        if (f.bytes && f.bytes > MAX_DOC) {
            return sock.sendMessage(chatId, {
                text: `📦 *${title}* (${sizeTxt})\n\nFile bari hai, direct link:\n${f.url}\n\n${FOOT}`
            }, { quoted: message });
        }

        try {
            await sock.sendMessage(chatId, {
                document: { url: f.url },
                mimetype: 'application/vnd.android.package-archive',
                fileName: f.name || clean(title) + '.apk',
                caption: icon ? undefined : caption,
            }, { quoted: message });
        } catch {
            await sock.sendMessage(chatId, {
                text: `📦 *${title}* (${sizeTxt})\n\n${f.url}\n\n${FOOT}`
            }, { quoted: message });
        }
    } catch (err) {
        console.error('[apk]', err.message);
        await sock.sendMessage(chatId, {
            text: `🚫 APK nahi mila.\n_${err.message}_\n\n${FOOT}`
        }, { quoted: message });
    }
}

module.exports = apkCommand;
module.exports.apkCommand = apkCommand;
module.exports.default = apkCommand;
