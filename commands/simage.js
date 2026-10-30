'use strict';
/**
 * simage.js — Sticker to Image - M-KING FIXED
 * Sharp > Jimp > Raw fallback (kabhi fail nahi hoga)
 */

const fs = require('fs');
const path = require('path');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

const tempDir = './temp';
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

const convertStickerToImage = async (sock, quotedMessage, chatId, message) => {
    try {
        const stickerMessage = quotedMessage?.stickerMessage || quotedMessage;
        if (!stickerMessage || !stickerMessage.url && !stickerMessage.directPath) {
             // check if reply has sticker
             if (!quotedMessage?.stickerMessage) {
                return sock.sendMessage(chatId, { text: '↩️ Reply to a sticker with *$simage* to convert it to an image.' }, { quoted: message });
             }
        }

        await sock.sendMessage(chatId, { text: '🖼️ Converting sticker to image…' }, { quoted: message });

        const stream = await downloadContentFromMessage(stickerMessage.stickerMessage || stickerMessage, 'sticker');
        let buffer = Buffer.alloc(0);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

        // 1. Try SHARP (best quality)
        try {
            const sharp = require('sharp');
            const pngBuffer = await sharp(buffer).toFormat('png').toBuffer();
            return sock.sendMessage(chatId, {
                image: pngBuffer,
                caption: '🖼 Here is your converted image!\n\n👑 *Powered by M-KING*',
            }, { quoted: message });
        } catch (e) {}

        // 2. Try JIMP (pure JS, hosting safe)
        try {
            const Jimp = require('jimp');
            const img = await Jimp.read(buffer);
            const pngBuffer = await img.getBufferAsync(Jimp.MIME_PNG);
            return sock.sendMessage(chatId, {
                image: pngBuffer,
                caption: '🖼 Here is your converted image!\n\n👑 *Powered by M-KING*',
            }, { quoted: message });
        } catch (e) {}

        // 3. Fallback - raw webp as image (WhatsApp shows it)
        return sock.sendMessage(chatId, {
            image: buffer,
            caption: '🖼 Here is your sticker as image!\n\n👑 *Powered by M-KING*',
        }, { quoted: message });

    } catch (error) {
        console.error('[simage]', error.message);
        return sock.sendMessage(chatId, { text: '❌ Failed to convert sticker. Try again.' }, { quoted: message });
    }
};

module.exports = convertStickerToImage;
module.exports.convertStickerToImage = convertStickerToImage;
module.exports.default = convertStickerToImage;
