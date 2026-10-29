'use strict';
const axios                 = require('axios');
const yts                   = require('yt-search');
const { get }               = require('../lib/gifted');
const { toOgg, toBuffer }   = require('../lib/media');

let _scraper;
function getScraper() {
    if (!_scraper) _scraper = require('ruhend-scraper');
    return _scraper;
}

// NEW APIS - Same as working bot
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';
const HECTOR_API = 'https://yt-dl.officialhectormanuel.workers.dev';
const PRINCE_API = 'https://api.princetechn.com';
const PRINCE_API_KEY = 'prince';

let _config;
function getConfig() {
    if (!_config) {
        try { _config = require('../../config'); } catch { try { _config = require('../config'); } catch { _config = {}; } }
    }
    return _config;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function pickUrl(result) {
  const url = result?.download || result?.dl_url || result?.dl || result?.downloadUrl;
  return url && /^https?:\/\//i.test(url) ? url : null;
}

function isIpLockedCdn(url) {
  return /googlevideo\.com|youtube\.com\/videoplayback/i.test(String(url || ''));
}

function extractYouTubeId(input) {
  const text = String(input || '').trim();
  const patterns = [
    /(?:youtube\.com\/(?:watch\?.*?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function toYouTubeWatchUrl(input) {
  const id = extractYouTubeId(input);
  return id ? `https://youtu.be/${id}` : String(input || '').trim();
}

async function ytSearch(input) {
    if (/youtube\.com|youtu\.be/i.test(input)) {
        return { url: input, title: input, thumbnail: null, duration: '', author: '', views: '' };
    }
    const { videos } = await yts(input);
    if (!videos?.length) throw new Error('No results: ' + input);
    const v = videos[0];
    return {
        url: v.url, title: v.title, thumbnail: v.thumbnail || v.image || null,
        duration: v.timestamp || '', author: v.author?.name || '',
        views: v.views ? Number(v.views).toLocaleString() : '',
    };
}

function findDownloadUrl(value, seen = new Set()) {
    if (typeof value === 'string') {
        return /^https?:\/\//i.test(value) && !/youtube\.com|youtu\.be/i.test(value) ? value : null;
    }
    if (!value || typeof value !== 'object' || seen.has(value)) return null;
    seen.add(value);
    const keys = ['download_url', 'downloadUrl', 'audio_url', 'audioUrl', 'download', 'audio', 'url', 'link', 'mp3', 'dlink'];
    for (const key of keys) {
        const candidate = value[key];
        if (typeof candidate === 'string' && /^https?:\/\//i.test(candidate) && !/youtube\.com|youtu\.be/i.test(candidate)) return candidate;
    }
    for (const child of Object.values(value)) {
        const found = findDownloadUrl(child, seen);
        if (found) return found;
    }
    return null;
}

function getTitle(value, fallback) {
    if (!value || typeof value !== 'object') return fallback;
    for (const key of ['title', 'name', 'audioTitle']) {
        if (typeof value[key] === 'string' && value[key].trim()) return value[key].trim();
    }
    for (const child of Object.values(value)) {
        if (child && typeof child === 'object') {
            const found = getTitle(child, '');
            if (found) return found;
        }
    }
    return fallback;
}

// Working bot ke APIs - same to same
async function hectorSongDownload(url) {
  const { data } = await axios.get(HECTOR_API, {
    params: { url },
    timeout: 90000,
    headers: { Accept: 'application/json', 'User-Agent': UA },
  });
  if (!data?.audio) throw new Error('Hector returned no audio');
  return { dl: data.audio, title: data.title || url };
}

async function princeSongDownload(url) {
  const watchUrl = toYouTubeWatchUrl(url);
  const endpoint = new URL('/api/download/ytmp3', PRINCE_API);
  endpoint.searchParams.set('apikey', PRINCE_API_KEY);
  endpoint.searchParams.set('url', watchUrl);
  const { data } = await axios.get(endpoint.toString(), {
    timeout: 120000,
    headers: { Accept: 'application/json', 'User-Agent': UA },
  });
  if (!data?.result?.downloadUrl && !data?.result?.download) throw new Error('Prince returned no url');
  const dl = data.result.downloadUrl || data.result.download;
  if (isIpLockedCdn(dl)) throw new Error('IP-locked');
  return { dl, title: data.result.title || url };
}

async function knightSongDownload(url) {
  const cfg = getConfig();
  const YT_API = cfg.mediaApiUrl;
  const YT_API_KEY = cfg.mediaApiKey;
  if (!YT_API || !YT_API_KEY) throw new Error('Knight config missing');
  const { data } = await axios.get(`${YT_API}/api/download/ytaudio`, {
    params: { apikey: YT_API_KEY, format: '128kbps', url },
    timeout: 180000,
    headers: { Accept: 'application/json', 'User-Agent': UA },
  });
  const result = data.result || data;
  const dl = pickUrl(result) || findDownloadUrl(result);
  if (!dl) throw new Error('Knight returned no url');
  return { dl, title: result.title || url };
}

async function resolveAudioUrl(ytUrl) {
    // Same order as working bot - Hector first, then Knight, then Prince
    const methods = [
        () => hectorSongDownload(ytUrl),
        () => knightSongDownload(ytUrl),
        () => princeSongDownload(ytUrl),
        async () => {
            const { ytmp3 } = getScraper();
            const data = await ytmp3(ytUrl);
            const dl = data?.audio || data?.download_url || data?.url || null;
            if (!dl) throw new Error('scraper no url');
            return { dl, title: data?.title || ytUrl };
        },
    ];

    for (const fn of methods) {
        try {
            const res = await fn();
            if (res?.dl && !isIpLockedCdn(res.dl)) return res;
        } catch (e) {
            console.warn('[ytaudio] method failed:', e.message);
            continue;
        }
    }

    // Last fallback - GiftedTech
    const endpoints = [
        () => get('/download/ytaudio', { url: ytUrl }, 90000),
        () => get('/download/ytmp3', { url: ytUrl, quality: '128kbps' }, 90000),
    ];
    for (const ep of endpoints) {
        try {
            const data = await ep();
            const body = data?.result || data;
            const dl = findDownloadUrl(body);
            if (dl) return { dl, title: getTitle(body, ytUrl) };
        } catch {}
    }
    throw new Error('All audio endpoints failed');
}

async function sendBanner(sock, chatId, message, meta, action) {
    const caption = [
        `🎵 *${meta.title}*`, meta.author ? `👤 ${meta.author}` : '',
        meta.duration ? `⏱️ ${meta.duration}` : '', meta.views ? `👁️ ${meta.views} views` : '',
        '', `⬇️ _${action}_`,
    ].filter(Boolean).join('\n');
    if (meta.thumbnail) {
        try { return await sock.sendMessage(chatId, { image: { url: meta.thumbnail }, caption }, { quoted: message }); }
        catch { /* fall through */ }
    }
    return sock.sendMessage(chatId, { text: caption }, { quoted: message });
}

async function ytaudioCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const input = text.replace(/^\$ytaudio\s*/i, '').replace(/^\$play\s*/i, '').trim();
        if (!input) return sock.sendMessage(chatId,
            { text: '🎵 Usage: $ytaudio <song name or YouTube URL>' }, { quoted: message });
        const meta = await ytSearch(input);
        await sendBanner(sock, chatId, message, meta, 'Downloading audio…');
        const { dl } = await resolveAudioUrl(meta.url);
        const mp3Buf = await toBuffer(dl);
        try {
            const oggBuf = await toOgg(mp3Buf);
            if (oggBuf && oggBuf.length) {
                return await sock.sendMessage(chatId, {
                    audio: oggBuf,
                    mimetype: 'audio/ogg; codecs=opus',
                    ptt: true,
                }, { quoted: message });
            }
        } catch {}
        // fallback to mp3 if ogg fails (ffmpeg missing)
        await sock.sendMessage(chatId, {
            audio: mp3Buf,
            mimetype: 'audio/mpeg',
            ptt: false,
        }, { quoted: message });
    } catch (err) {
        console.error('[ytaudio]', err.message);
        await sock.sendMessage(chatId, { text: '❌ Audio download failed. Try again.' }, { quoted: message });
    }
}

async function ytaudioDocCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const input = text.replace(/^\$ytaudiodoc\s*/i, '').trim();
        if (!input) return sock.sendMessage(chatId,
            { text: '🎵 Usage: $ytaudiodoc <song name or YouTube URL>' }, { quoted: message });
        const meta = await ytSearch(input);
        await sendBanner(sock, chatId, message, meta, 'Downloading audio file…');
        const { dl, title } = await resolveAudioUrl(meta.url);
        const buf = await toBuffer(dl);
        await sock.sendMessage(chatId, {
            document: buf,
            mimetype: 'audio/mpeg',
            fileName: `${title}.mp3`,
        }, { quoted: message });
    } catch (err) {
        console.error('[ytaudiodoc]', err.message);
        await sock.sendMessage(chatId, { text: '❌ Audio file download failed. Try again.' }, { quoted: message });
    }
}

module.exports = { ytaudioCommand, ytaudioDocCommand };
