'use strict';
const axios = require('axios');
const { get } = require('../lib/gifted');

const processedMessages = new Set();

function getCmdEmoji(cmd) {
    const map = {
        'tiktok': '🎵',
        'downloader': '🎵',
        'error': '❌',
        'loading': '⏳',
        'success': '✅'
    };
    return map[cmd.toLowerCase()] || '📌';
}

function proBox(title, emoji, linesArr) {
    const e = emoji || getCmdEmoji(title);
    const t = title.toUpperCase();
    const body = linesArr.map(l => `║ ❃ → ${l}`).join('\n');
    return `╔══『 ${e} ${t} 』══╗
${body}
╚══『 *M-KING* 👑 』══╝`;
}

async function toBuffer(url) {
    const res = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 90000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    return Buffer.from(res.data);
}

async function tikWmApi(url) {
    const { data } = await axios.get('https://www.tikwm.com/api/', {
        params: { url, hd: 1 },
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 20000
    });
    if (data?.data?.play) {
        let video = data.data.play;
        if (video.startsWith('/')) video = 'https://www.tikwm.com' + video;
        return {
            video: video,
            title: data.data.title || 'TikTok',
            author: data.data.author?.nickname || data.data.author?.unique_id || 'Unknown',
            server: 'TikTok'
        };
    }
    throw new Error('TikWM fail');
}

async function princeApi(url) {
    const { data } = await axios.get('https://api.princetechn.com/api/download/tiktok', {
        params: { apikey: 'prince', url },
        timeout: 20000
    });
    const r = data?.result || data;
    let video = r?.video || r?.download || r?.play || r?.url;
    if (video) {
        if (video.startsWith('/')) video = 'https://www.tikwm.com' + video;
        return {
            video,
            title: r.title || r.desc || 'TikTok',
            author: r.author || r.username || 'Unknown',
            server: 'Prince'
        };
    }
    throw new Error('Prince fail');
}

async function giftedApi(url) {
    const data = await get('/download/tiktok', { url });
    const r = data?.result || {};
    let video = r.download_url || r.video || r.url || r.nowm;
    if (!video) throw new Error('Gifted fail');
    if (video.startsWith('/')) video = 'https://www.tikwm.com' + video;
    return {
        video,
        title: r.title || r.desc || 'TikTok Video',
        author: r.author || 'Unknown',
        server: 'Gifted'
    };
}

async function tiktokCommand(sock, chatId, message) {
    if (processedMessages.has(message.key.id)) return;
    processedMessages.add(message.key.id);
    setTimeout(() => processedMessages.delete(message.key.id), 5 * 60 * 1000);
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const url  = text.split(' ').slice(1).join(' ').trim();
    if (!url) return sock.sendMessage(chatId, { text: proBox('TIKTOK', '🎵', ['🎵 *Usage:* $tiktok <TikTok URL>', '📚 *Example:* $tiktok https://vt.tiktok.com/...']) }, { quoted: message });
    try {
        await sock.sendMessage(chatId, { text: `⏳ _Downloading TikTok video…_` }, { quoted: message });
        let result = null;
        try { result = await tikWmApi(url); } catch {}
        if (!result) { try { result = await princeApi(url); } catch {} }
        if (!result) { result = await giftedApi(url); }
        if (!result?.video) throw new Error('No download URL returned');
        const buf = await toBuffer(result.video);
        
        // ─── REAL + AUTO BOX - No compress, sab andar ───
        const clean = (t) => t.replace(/\n/g, ' ').trim();
        const fullAuthor = clean(result.author);
        const fullTitle = clean(result.title);

        // Auto wrap - lamba ho to dusri line box ke andar hi
        function wrapLine(prefix, text, maxW) {
            let out = [];
            let remain = text;
            let first = true;
            while (remain.length > 0) {
                let limit = first ? maxW - prefix.length : maxW - 10;
                out.push((first ? prefix : '          ') + remain.slice(0, limit));
                remain = remain.slice(limit);
                first = false;
            }
            return out;
        }

        const INNER = 34;
        let allLines = [];
        allLines.push(`❃ → 👤 Author: ${fullAuthor}`);
        allLines.push(...wrapLine(`❃ → 📝 Title: `, fullTitle, INNER));
        allLines.push(`❃ → 🔌 Server: ${result.server}`);

        let maxLen = Math.max(...allLines.map(l => l.length));
        let border = '═'.repeat(maxLen + 2);

        let caption = `╔${border}╗\n║\n`;
        allLines.forEach(l => {
            caption += `║ ${l.padEnd(maxLen)} ║\n`;
        });
        caption += `║\n╚${border}╝\n     『 *M-KING* 👑 』`;

        await sock.sendMessage(chatId, {
            video: buf, mimetype: 'video/mp4',
            caption: caption,
        }, { quoted: message });
    } catch (err) {
        console.error('[tiktok]', err.message);
        await sock.sendMessage(chatId, { text: proBox('FAILED', '❌', [`❌ *Failed:* ${err.message}`, '💡 *Try again* with valid URL']) }, { quoted: message });
    }
}

module.exports = tiktokCommand;
module.exports.tiktokCommand = tiktokCommand;
module.exports.default = tiktokCommand;
