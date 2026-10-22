'use strict';
/**
 * commands/autoreactg.js — GLOBAL auto-reaction manager
 * Multiple emojis support: "$autoreactg on 15 🦜,💯,👏" → har message pe random emoji.
 */

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'autoreactg.json');

function load() {
    try {
        const d = JSON.parse(fs.readFileSync(FILE, 'utf8'));
        if (!d.chats || typeof d.chats !== 'object') d.chats = {};
        if (!d.default) d.default = '😍';
        if (!Array.isArray(d.lastList)) d.lastList = [];
        return d;
    } catch (_) {
        return { default: '😍', chats: {}, lastList: [] };
    }
}

function save(d) {
    try {
        const dir = path.dirname(FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
    } catch (e) { console.log('[autoreactg] save error: ' + e.message); }
}

function toList(v) {
    if (Array.isArray(v)) return v.filter(Boolean);
    if (typeof v === 'string') return v.split(/[,\s]+/).map(function (x) { return x.trim(); }).filter(Boolean);
    return [];
}

function pick(arr) {
    if (!arr || !arr.length) return null;
    return arr[Math.floor(Math.random() * arr.length)];
}

async function handleAutoReactG(sock, message) {
    try {
        if (!message || !message.key || message.key.fromMe) return false;
        const chatId = message.key.remoteJid;
        if (!chatId || chatId === 'status@broadcast') return false;
        const d = load();
        const list = toList(d.chats[chatId]);
        if (!list.length) return false;
        const emoji = pick(list);
        await sock.sendMessage(chatId, { react: { text: emoji, key: message.key } });
        return true;
    } catch (_) { return false; }
}

async function buildList(sock, d) {
    let groups = {};
    try { groups = (await sock.groupFetchAllParticipating()) || {}; } catch (_) {}
    const list = Object.keys(groups);
    for (const jid of Object.keys(d.chats)) {
        if (!jid.endsWith('@g.us') && list.indexOf(jid) === -1) list.push(jid);
    }
    d.lastList = list;
    save(d);
    return { list: list, groups: groups };
}

function resolve(d, token) {
    if (!token) return null;
    if (/^\d{1,3}$/.test(token)) {
        const jid = d.lastList[parseInt(token, 10) - 1];
        if (jid) return jid;
    }
    const digits = token.replace(/\D/g, '');
    if (digits.length >= 10) return digits + '@s.whatsapp.net';
    return null;
}

function helpCard(d) {
    const on = Object.keys(d.chats).length;
    const def = toList(d.default).join(' ');
    return '*⚡ AUTO REACT (GLOBAL)*\n\n' +
        'ON: ' + on + ' chat\n' +
        'Default: ' + def + '\n\n' +
        '*Commands:*\n' +
        '$autoreactg list — saare groups ki list\n' +
        '$autoreactg on 3 🔥 — #3 on (ek emoji)\n' +
        '$autoreactg on 3 🔥,😍,💯 — #3 on (random, har message pe)\n' +
        '$autoreactg off 3 — #3 off\n' +
        '$autoreactg on 923001234567 😍 — number ke DM pe on\n' +
        '$autoreactg all on 🔥,🥳 — sab on\n' +
        '$autoreactg all off — sab off\n' +
        '$autoreactg emoji 🔥,😍 — default list set';
}

async function autoreactgCommand(sock, chatId, message, userMessage, isOwner) {
    const raw = (userMessage || '').trim();
    const args = raw.split(/\s+/).slice(1);
    const sub = (args[0] || '').toLowerCase();
    const d = load();

    if (isOwner === false) {
        return sock.sendMessage(chatId, { text: '❌ Ye command sirf owner ke liye hai.' }, { quoted: message });
    }

    if (!sub || sub === 'help' || sub === 'status') {
        return sock.sendMessage(chatId, { text: helpCard(d) }, { quoted: message });
    }

    if (sub === 'list') {
        const r = await buildList(sock, d);
        if (!r.list.length) {
            return sock.sendMessage(chatId, { text: '❌ Bot kisi group mein nahi hai.' }, { quoted: message });
        }
        const lines = r.list.map(function (jid, i) {
            const nm = r.groups[jid] ? r.groups[jid].subject : jid.split('@')[0];
            return (i + 1) + '. ' + nm;
        });
        return sock.sendMessage(chatId, {
            text: '*📋 CHAT LIST* (' + r.list.length + ')\n\n' + lines.join('\n') +
                  '\n\nAb likho: *$autoreactg on <number> 🔥,😍*'
        }, { quoted: message });
    }

    if (sub === 'emoji' || sub === 'default') {
        const list = toList(args.slice(1).join(' '));
        if (!list.length) {
            return sock.sendMessage(chatId, { text: 'Usage: $autoreactg emoji 🔥,😍,💯' }, { quoted: message });
        }
        d.default = list;
        save(d);
        return sock.sendMessage(chatId, { text: '✅ Default emoji list set: ' + list.join(' ') }, { quoted: message });
    }

    if (sub === 'all') {
        const act = (args[1] || '').toLowerCase();
        let list = toList(args.slice(2).join(' '));
        if (!list.length) list = toList(d.default);
        if (act === 'on') {
            const r = await buildList(sock, d);
            for (const jid of r.list) d.chats[jid] = list.slice();
            save(d);
            return sock.sendMessage(chatId, { text: '✅ Sab ' + r.list.length + ' chats pe auto-react ON (' + list.join(' ') + ')' }, { quoted: message });
        }
        if (act === 'off') {
            d.chats = {}; save(d);
            return sock.sendMessage(chatId, { text: '✅ Sab chats pe auto-react OFF' }, { quoted: message });
        }
        return sock.sendMessage(chatId, { text: 'Usage: $autoreactg all on/off [🔥,😍]' }, { quoted: message });
    }

    if (sub === 'on' || sub === 'off') {
        const token = args[1];
        if (!token) {
            return sock.sendMessage(chatId, { text: 'Usage: $autoreactg ' + sub + ' <list ka number> [🔥,😍]' }, { quoted: message });
        }
        const jid = resolve(d, token);
        if (!jid) {
            return sock.sendMessage(chatId, { text: '❌ Pehle *$autoreactg list* chalao, phir uska number do.' }, { quoted: message });
        }
        if (sub === 'off') {
            delete d.chats[jid]; save(d);
            return sock.sendMessage(chatId, { text: '✅ OFF: ' + jid.split('@')[0] }, { quoted: message });
        }
        let list = toList(args.slice(2).join(' '));
        if (!list.length) list = toList(d.default);
        d.chats[jid] = list;
        save(d);
        return sock.sendMessage(chatId, { text: '✅ ON: ' + jid.split('@')[0] + ' → ' + list.join(' ') + '\n(har message pe in mein se ek random emoji lagega)' }, { quoted: message });
    }

    return sock.sendMessage(chatId, { text: helpCard(d) }, { quoted: message });
}

module.exports = { autoreactgCommand, handleAutoReactG };