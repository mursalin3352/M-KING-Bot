'use strict';

const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

let webp = null;
try { webp = require('node-webpmux'); } catch { }

let settings = {};
try { settings = require('../settings') || {}; } catch { }

const SIZE = 512;
const PAD = 34;
const MAX_LINES = 4;
const WRAP_CHARS = 14;
const DURATION = 1.6;
const FPS = 15;

const FONT_CANDIDATES = [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    '/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf',
    '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf',
    '/system/fonts/Roboto-Bold.ttf',
    '/usr/local/share/fonts/DejaVuSans-Bold.ttf',
    'C:/Windows/Fonts/arialbd.ttf',
    'C:/Windows/Fonts/segoeuib.ttf',
];

function findFont() {
    for (const f of FONT_CANDIDATES) {
        try { if (fs.existsSync(f)) return f; } catch { }
    }
    return null;
}

function runFfmpeg(args, timeout) {
    return new Promise((resolve, reject) => {
        const ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args]);
        const out = [];
        const err = [];
        const timer = setTimeout(() => { try { ff.kill('SIGKILL'); } catch { } reject(new Error('ffmpeg timeout')); }, timeout || 25000);

        ff.stdout.on('data', c => out.push(c));
        ff.stderr.on('data', c => err.push(c));
        ff.on('error', e => { clearTimeout(timer); reject(e); });
        ff.on('close', code => {
            clearTimeout(timer);
            if (code === 0 && out.length) return resolve(Buffer.concat(out));
            reject(new Error(Buffer.concat(err).toString().trim().slice(0, 300) || 'ffmpeg code ' + code));
        });
    });
}

function wrapText(text) {
    const words = String(text).replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    const lines = [];
    let cur = '';

    for (const w of words) {
        if (w.length > WRAP_CHARS) {
            if (cur) { lines.push(cur); cur = ''; }
            for (let i = 0; i < w.length; i += WRAP_CHARS) lines.push(w.slice(i, i + WRAP_CHARS));
            continue;
        }
        const next = cur ? cur + ' ' + w : w;
        if (next.length > WRAP_CHARS) { lines.push(cur); cur = w; }
        else cur = next;
    }
    if (cur) lines.push(cur);

    if (lines.length > MAX_LINES) {
        lines.length = MAX_LINES;
        lines[MAX_LINES - 1] = lines[MAX_LINES - 1].replace(/\s+\S*$/, '') + '…';
    }
    return lines.length ? lines : [' '];
}

async function renderSticker(text, color, quality) {
    const lines = wrapText(text);
    const longest = Math.max(...lines.map(l => l.length), 1);

    const usable = SIZE - PAD * 2;
    let fs2 = Math.floor(usable / longest);
    fs2 = Math.max(26, Math.min(78, fs2));

    const lineH = Math.round(fs2 * 1.25);
    const totalH = lineH * lines.length;
    let y = Math.round((SIZE - totalH) / 2 + (lineH - fs2) / 2);
    y = Math.max(6, y);

    const font = findFont();
    const tmpFiles = [];
    const filters = [];

    try {
        for (let i = 0; i < lines.length; i++) {
            const f = path.join(os.tmpdir(), `attp_${process.pid}_${Date.now()}_${i}.txt`);
            fs.writeFileSync(f, lines[i], 'utf8');
            tmpFiles.push(f);

            const fontPart = font ? `fontfile='${font}':` : 'font=Sans:';
            filters.push(
                `drawtext=${fontPart}textfile='${f}':fontsize=${fs2}:` +
                `x=(w-text_w)/2:y=${y + i * lineH}:` +
                `fontcolor=${color}:borderw=3:bordercolor=black@0.8`
            );
        }

        const vf = filters.join(',');
        const base = [
            '-f', 'lavfi', '-i', `color=c=black@0.0:s=${SIZE}x${SIZE}:d=${DURATION}:r=${FPS}`,
            '-vf', vf,
        ];
        const tail = ['-loop', '0', '-an', '-f', 'webp', 'pipe:1'];

        const attempts = [
            [...base, '-c:v', 'libwebp_anim', '-lossless', '0', '-q:v', String(quality), '-compression_level', '6', ...tail],
            [...base, '-c:v', 'libwebp', '-lossless', '0', '-q:v', String(quality), ...tail],
        ];

        let lastErr;
        for (const args of attempts) {
            try {
                const buf = await runFfmpeg(args);
                if (buf && buf.length > 200) return buf;
            } catch (e) { lastErr = e; }
        }
        throw lastErr || new Error('encoder failed');
    } finally {
        for (const f of tmpFiles) { try { fs.unlinkSync(f); } catch { } }
    }
}

async function addMetadata(buffer) {
    if (!webp) return buffer;
    try {
        const image = new webp.Image();
        await image.load(buffer);
        const json = {
            'sticker-pack-id': crypto.randomBytes(16).toString('hex'),
            'sticker-pack-name': settings.packname || 'M-KING',
            'sticker-pack-publisher': settings.author || 'M-KING',
            emojis: ['🤖'],
        };
        const header = Buffer.from([
            0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00,
            0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
        ]);
        const jsonBuffer = Buffer.from(JSON.stringify(json));
        const exif = Buffer.concat([header, jsonBuffer]);
        exif.writeUInt32LE(jsonBuffer.length, 14);
        image.exif = exif;
        const out = await image.save(null);
        return out && out.length ? Buffer.from(out) : buffer;
    } catch {
        return buffer;
    }
}

const COLORS = {
    white: 'white', black: 'black', red: 'red', green: 'lime', blue: 'deepskyblue',
    yellow: 'yellow', pink: 'hotpink', orange: 'orange', purple: 'mediumpurple',
    gold: 'gold', cyan: 'cyan',
};

async function attpCommand(sock, chatId, message) {
    const raw = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    let body = raw.replace(/^\S+\s*/, '').trim();

    if (!body) {
        return sock.sendMessage(chatId, {
            text: [
                '🎬 *ANIMATED TEXT STICKER*', '',
                '`$attp <text>`',
                '`$attp -c red <text>` — colour',
                '',
                '_Colours: white, red, green, blue, yellow, pink, orange, purple, gold_',
                '',
                '_M-KING_ ⚡',
            ].join('\n'),
        }, { quoted: message });
    }

    let color = 'white';
    const cm = body.match(/^-c\s+(\w+)\s+/i);
    if (cm) {
        const c = cm[1].toLowerCase();
        if (COLORS[c]) color = COLORS[c];
        body = body.slice(cm[0].length).trim();
    }
    if (!body) body = ' ';

    try {
        await sock.sendMessage(chatId, { react: { text: '🎬', key: message.key } });

        let buf = await renderSticker(body, color, 62);

        if (buf.length > 900 * 1024) {
            try {
                const smaller = await renderSticker(body, color, 42);
                if (smaller.length < buf.length) buf = smaller;
            } catch { }
        }

        const finalBuf = await addMetadata(buf);

        await sock.sendMessage(chatId, {
            sticker: finalBuf,
            mimetype: 'image/webp',
        }, { quoted: message });
    } catch (err) {
        console.error('[attp]', err.message);
        await sock.sendMessage(chatId, {
            text: `❌ Sticker ban nahi saka.\n_${err.message.slice(0, 160)}_`
        }, { quoted: message });
    }
}

module.exports = attpCommand;
module.exports.attpCommand = attpCommand;
module.exports.default = attpCommand;
