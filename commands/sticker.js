'use strict';

const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const webp = require('node-webpmux');
const settings = require('../settings');

function textOf(message) {
    return message?.conversation ||
        message?.extendedTextMessage?.text ||
        message?.imageMessage?.caption ||
        message?.videoMessage?.caption ||
        message?.documentMessage?.caption || '';
}

function getQuotedMessage(message) {
    return message?.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;
}

function extractUrl(text) {
    const match = String(text || '').match(/https?:\/\/[^\s<>]+/i);
    return match ? match[0].replace(/[),.!?]+$/, '') : null;
}

async function downloadUrl(url) {
    const response = await fetch(url, {
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: '*/*' }
    });
    if (!response.ok) throw new Error(`URL returned HTTP ${response.status}`);
    return {
        buffer: Buffer.from(await response.arrayBuffer()),
        contentType: response.headers.get('content-type') || ''
    };
}

function runFfmpegFile(inputPath, outputPath, args) {
    return new Promise((resolve, reject) => {
        const ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', inputPath, ...args, outputPath]);
        let err = '';
        ff.stderr.on('data', d => err += d.toString());
        ff.on('error', reject);
        ff.on('close', code => {
            if (code === 0 && fs.existsSync(outputPath)) return resolve();
            reject(new Error(err || `ffmpeg exited ${code}`));
        });
    });
}

async function convertToWebp(inputBuffer, animated) {
    const tmpDir = path.join(process.cwd(), 'tmp');
    fs.mkdirSync(tmpDir, { recursive: true });
    const id = Date.now() + '-' + Math.random().toString(16).slice(2);
    const inPath = path.join(tmpDir, `in-${id}`);
    const outPath = path.join(tmpDir, `out-${id}.webp`);
    fs.writeFileSync(inPath, inputBuffer);

    try {
        if (animated) {
            // FIXED + AUTO CROP FULL SIZE - eval=frame hataya, crop center
            await runFfmpegFile(inPath, outPath, [
                '-vf', 'scale=512:512:force_original_aspect_ratio=increase:flags=lanczos,crop=512:512:(in_w-out_w)/2:(in_h-out_h)/2,fps=15',
                '-c:v', 'libwebp_anim',
                '-loop', '0',
                '-preset', 'default',
                '-an', '-vsync', '0',
                '-t', '6'
            ]);
        } else {
            // IMAGE - AUTO CORRECT CROP FULL SIZE
            await runFfmpegFile(inPath, outPath, [
                '-vf', 'scale=512:512:force_original_aspect_ratio=increase,crop=512:512:(in_w-out_w)/2:(in_h-out_h)/2',
                '-frames:v', '1',
                '-c:v', 'libwebp',
                '-q:v', '80'
            ]);
        }
        const buf = fs.readFileSync(outPath);
        return buf;
    } finally {
        try { fs.unlinkSync(inPath); } catch {}
        try { fs.unlinkSync(outPath); } catch {}
    }
}

async function addMetadata(buffer) {
    const image = new webp.Image();
    await image.load(buffer);
    const json = {
        'sticker-pack-id': crypto.randomBytes(16).toString('hex'),
        'sticker-pack-name': settings.packname || 'M-KING 👑',
        'sticker-pack-publisher': settings.author || 'Mursalin King 👑',
        emojis: ['👑']
    };
    const exifHeader = Buffer.from([
        0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00,
        0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x16, 0x00, 0x00, 0x00
    ]);
    const jsonBuffer = Buffer.from(JSON.stringify(json));
    const exif = Buffer.concat([exifHeader, jsonBuffer]);
    exif.writeUInt32LE(jsonBuffer.length, 14);
    image.exif = exif;
    return image.save(null);
}

async function stickerCommand(sock, chatId, message) {
    const quotedMessage = getQuotedMessage(message);
    const targetMessage = quotedMessage ? {
        key: {
            remoteJid: chatId,
            id: message.message?.extendedTextMessage?.contextInfo?.stanzaId,
            participant: message.message?.extendedTextMessage?.contextInfo?.participant
        },
        message: quotedMessage
    } : message;

    const mediaMessage = targetMessage.message?.imageMessage ||
        targetMessage.message?.videoMessage ||
        targetMessage.message?.documentMessage;
    const commandText = textOf(message.message);
    const quotedText = quotedMessage ? textOf(quotedMessage) : '';
    const url = extractUrl(quotedText) || extractUrl(commandText.replace(/^\$s(ticker)?\s*/i, ''));

    if (!mediaMessage && !url) {
        return sock.sendMessage(chatId, {
            text: 'Reply to an image/video or an image URL with $sticker.'
        }, { quoted: message });
    }

    let tempInput;
    try {
        let mediaBuffer;
        let contentType = '';
        if (mediaMessage) {
            mediaBuffer = await downloadMediaMessage(targetMessage, 'buffer', {}, {
                logger: undefined,
                reuploadRequest: sock.updateMediaMessage
            });
            contentType = mediaMessage.mimetype || '';
        } else {
            const downloaded = await downloadUrl(url);
            mediaBuffer = downloaded.buffer;
            contentType = downloaded.contentType;
        }
        if (!mediaBuffer?.length) throw new Error('Downloaded media is empty');

        const animated = /video|gif|webm/i.test(contentType) ||
            Boolean(mediaMessage?.seconds) || /\.(gif|mp4|webm|mov)(?:\?|$)/i.test(url || '');
        
        let webpBuffer = await convertToWebp(mediaBuffer, animated);

        // Agar size 1MB se zyada ho to chota karo - FULL SIZE CROP ke saath
        if (webpBuffer.length > 900 * 1024 && animated) {
            const tmpDir = path.join(process.cwd(), 'tmp');
            const id = Date.now() + '-small';
            const inPath = path.join(tmpDir, `in-${id}`);
            const outPath = path.join(tmpDir, `out-${id}.webp`);
            fs.writeFileSync(inPath, mediaBuffer);
            await runFfmpegFile(inPath, outPath, [
                '-vf', 'scale=512:512:force_original_aspect_ratio=increase,crop=512:512:(in_w-out_w)/2:(in_h-out_h)/2,fps=10',
                '-c:v', 'libwebp_anim',
                '-loop', '0',
                '-q:v', '30',
                '-t', '5'
            ]);
            webpBuffer = fs.readFileSync(outPath);
            try { fs.unlinkSync(inPath); } catch {}
            try { fs.unlinkSync(outPath); } catch {}
        }

        const finalBuffer = await addMetadata(webpBuffer);
        await sock.sendMessage(chatId, { sticker: finalBuffer }, { quoted: message });
    } catch (error) {
        console.error('[sticker]', error);
        await sock.sendMessage(chatId, {
            text: `Failed: ${error.message}. Reply to a valid image/video and try again.`
        }, { quoted: message });
    } finally {
        if (tempInput) {
            try { fs.unlinkSync(tempInput); } catch {}
        }
    }
}

module.exports = stickerCommand;
