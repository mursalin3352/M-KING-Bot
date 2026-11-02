'use strict';
const axios = require('axios');
const { get } = require('../lib/gifted');

const processedMessages = new Set();

// ─── 🔒 M-KING PRO DOUBLE BOX - AUTO EMOJI SYSTEM ────────────────────────────
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
    const body = linesArr.map(l => `║ ${l}`).join('\n');
    return `╔══『 ${e} ${t} 』══╗
${body}
╚══『 M-KING👑 』══╝`;
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
        // FIX 1 - Yahi error tha
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
    if (!url) return sock.sendMessage(chatId, { text: proBox('TIKTOK', '🎵', ['🎵 Usage: $tiktok <TikTok URL>', '📚 Example: $tiktok https://vt.tiktok.com/...']) }, { quoted: message });
    try {
        await sock.sendMessage(chatId, { text: proBox('DOWNLOADING', '⏳', ['⏳ Downloading TikTok video…', '🔌 Please wait']) }, { quoted: message });
        let result = null;
        try { result = await tikWmApi(url); } catch {}
        if (!result) { try { result = await princeApi(url); } catch {} }
        if (!result) { result = await giftedApi(url); }
        if (!result?.video) throw new Error('No download URL returned');
        const buf = await toBuffer(result.video);
        
        const caption = `╔══『 🎵 TIKTOK 』══╗
║ 👤 Author: ${result.author}
║ 📝 Title: ${result.title}
║ 🔌 Server: ${result.server}
╚══『 M-KING👑 』══╝`;

        await sock.sendMessage(chatId, {
            video: buf, mimetype: 'video/mp4',
            caption: caption,
        }, { quoted: message });
    } catch (err) {
        console.error('[tiktok]', err.message);
        await sock.sendMessage(chatId, { text: proBox('FAILED', '❌', [`❌ Failed: ${err.message}`, '💡 Try again with valid URL']) }, { quoted: message });
    }
}

module.exports = tiktokCommand;
module.exports.tiktokCommand = tiktokCommand;
module.exports.default = tiktokCommand;
