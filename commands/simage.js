'use strict';
/**
 * simage.js — Sticker to Image/Video - M-KING PROFESSIONAL - AUTO PLAY & LOOP
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

const tempDir = './temp';
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

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

const convertStickerToImage = async (sock, quotedMessage, chatId, message) => {
    try {
        if (!quotedMessage?.stickerMessage) {
            return sock.sendMessage(chatId, { text: '↩️ Reply to a sticker with *$simage*' }, { quoted: message });
        }

        await sock.sendMessage(chatId, { text: '🖼️ Converting sticker to image...' }, { quoted: message });

        const stream = await downloadContentFromMessage(quotedMessage.stickerMessage, 'sticker');
        let buffer = Buffer.alloc(0);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

        let isAnimated = false;
        try {
            const sharp = require('sharp');
            const meta = await sharp(buffer, { animated: true }).metadata();
            if ((meta.pages || 1) > 1) isAnimated = true;
        } catch {}
        if (!isAnimated && buffer.includes(Buffer.from('ANIM'))) isAnimated = true;
        if (!isAnimated && buffer.length > 35000) isAnimated = true;

        if (isAnimated) {
            try {
                const id = Date.now();
                const sharp = require('sharp');
                const gifBuffer = await sharp(buffer, { animated: true }).gif().toBuffer();
                const gifPath = path.join(tempDir, `simage-${id}.gif`);
                const mp4Path = path.join(tempDir, `simage-${id}.mp4`);
                fs.writeFileSync(gifPath, gifBuffer);

                await runFfmpegFile(gifPath, mp4Path, [
                    '-vf', 'scale=512:512:flags=lanczos:force_original_aspect_ratio=increase,crop=512:512:(in_w-out_w)/2:(in_h-out_h)/2,scale=trunc(iw/2)*2:trunc(ih/2)*2',
                    '-c:v', 'libx264',
                    '-pix_fmt', 'yuv420p',
                    '-movflags', '+faststart',
                    '-r', '15',
                    '-t', '6',
                    '-an'
                ]);

                const videoBuffer = fs.readFileSync(mp4Path);
                await sock.sendMessage(chatId, {
                    video: videoBuffer,
                    caption: '🖼️ Here is your converted sticker\n\n*Powered by M-KING👑*',
                    gifPlayback: true, // Isi se foran hilega, click nahi karna padega, loop chalega
                    mimetype: 'video/mp4'
                }, { quoted: message });

                try { fs.unlinkSync(gifPath); } catch {}
                try { fs.unlinkSync(mp4Path); } catch {}
                return;
            } catch (e) {
                console.error('[simage mp4]', e.message);
            }
        }

        try {
            const sharp = require('sharp');
            const pngBuffer = await sharp(buffer).png().toBuffer();
            return await sock.sendMessage(chatId, {
                image: pngBuffer,
                caption: '🖼️ Here is your converted sticker\n\n*Powered by M-KING👑*',
            }, { quoted: message });
        } catch {}

        return await sock.sendMessage(chatId, {
            image: buffer,
            caption: '🖼️ Here is your converted sticker\n\n*Powered by M-KING👑*',
        }, { quoted: message });

    } catch (error) {
        console.error('[simage]', error);
        return sock.sendMessage(chatId, { text: '❌ Failed: ' + error.message }, { quoted: message });
    }
};

module.exports = convertStickerToImage;
module.exports.convertStickerToImage = convertStickerToImage;
module.exports.default = convertStickerToImage;
