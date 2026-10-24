const { downloadContentFromMessage, downloadMediaMessage } = require('@whiskeysockets/baileys');

async function dlBuffer(mediaObj, mediaType, sock) {
    try {
        const fakeMsg = { message: { [`${mediaType}Message`]: mediaObj } };
        const buf = await downloadMediaMessage(fakeMsg, 'buffer', {}, {
            reuploadRequest: sock?.updateMediaMessage,
        });
        if (buf && buf.length) return buf;
    } catch (_) {}
    const stream = await downloadContentFromMessage(mediaObj, mediaType);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
}
const settings = require('../settings');

// $vv — re-send view-once in the same chat (jaisa tha waisa)
async function viewonceCommand(sock, chatId, message) {
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedImage = quoted?.imageMessage;
    const quotedVideo = quoted?.videoMessage;
    const quotedAudio = quoted?.audioMessage;

    if (quotedImage && quotedImage.viewOnce) {
        const buffer = await dlBuffer(quotedImage, 'image', sock);
        await sock.sendMessage(chatId, { image: buffer, fileName: 'media.jpg', caption: quotedImage.caption || '' }, { quoted: message });
    } else if (quotedVideo && quotedVideo.viewOnce) {
        const buffer = await dlBuffer(quotedVideo, 'video', sock);
        await sock.sendMessage(chatId, { video: buffer, fileName: 'media.mp4', caption: quotedVideo.caption || '' }, { quoted: message });
    } else if (quotedAudio && quotedAudio.viewOnce) {
        const buffer = await dlBuffer(quotedAudio, 'audio', sock);
        await sock.sendMessage(chatId, { audio: buffer, mimetype: 'audio/ogg; codecs=opus', ptt: quotedAudio.ptt || true }, { quoted: message });
    } else {
        await sock.sendMessage(chatId, { text: '❌ Please reply to a view-once image, video or voice.' }, { quoted: message });
    }
}

// $vv2 / $vvdm — ★★★ FIXED: Ab owner DM me NAHI, command dene wale ke DM me jayega ★★★
async function vvdmCommand(sock, chatId, message, noReact = false) {
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedImage = quoted?.imageMessage;
    const quotedVideo = quoted?.videoMessage;
    const quotedAudio = quoted?.audioMessage;

    if (!quotedImage?.viewOnce && !quotedVideo?.viewOnce && !quotedAudio?.viewOnce) {
        return sock.sendMessage(chatId, { text: '❌ Please reply to a view-once image, video or voice.' }, { quoted: message });
    }

    // ★★★ FIX: Jo command de raha hai usi ka JID ★★★
    // Owner wala system hata diya
    const senderJid = message.key.participant || message.key.remoteJid; // Jis ne command diya
    const targetJid = senderJid; // Usi ko bhejna hai, owner ko nahi

    const contextInfo = message.message?.extendedTextMessage?.contextInfo || {};
    const voSenderJid = contextInfo.participant || contextInfo.remoteJid || message.key.participant || message.key.remoteJid || '';
    const rawJid = voSenderJid.replace(/:\d+@/, '@');
    let senderDisplay = rawJid.split('@')[0];
    try { const name = await sock.getName(rawJid); if (name && !name.includes('@')) senderDisplay = name; } catch {}

    let chatLabel = 'Private';
    if (chatId.endsWith('@g.us')) { try { const meta = await sock.groupMetadata(chatId); chatLabel = meta.subject; } catch { chatLabel = 'Group'; } }

    try {
        if (quotedImage?.viewOnce) {
            const buffer = await dlBuffer(quotedImage, 'image', sock);
            await sock.sendMessage(targetJid, { // ★ targetJid = command dene wala
                image: buffer,
                caption: `📥 *View-once image*\nFrom: ${senderDisplay}\nChat: ${chatLabel}`,
            });
        } else if (quotedVideo?.viewOnce) {
            const buffer = await dlBuffer(quotedVideo, 'video', sock);
            await sock.sendMessage(targetJid, {
                video: buffer,
                caption: `📥 *View-once video*\nFrom: ${senderDisplay}\nChat: ${chatLabel}`,
            });
        } else if (quotedAudio?.viewOnce) {
            const buffer = await dlBuffer(quotedAudio, 'audio', sock);
            await sock.sendMessage(targetJid, {
                audio: buffer,
                mimetype: 'audio/ogg; codecs=opus',
                ptt: quotedAudio.ptt || true,
            });
            await sock.sendMessage(targetJid, {
                text: `📥 *View-once voice*\nFrom: ${senderDisplay}\nChat: ${chatLabel}`
            });
        }

        if (!noReact) {
            await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
        }
    } catch (err) {
        console.error('[vvdm]', err.message);
        await sock.sendMessage(chatId, { text: `❌ Failed to send to DM.\n_${err.message}_` }, { quoted: message });
    }
}

module.exports = viewonceCommand;
module.exports.vvdmCommand = vvdmCommand;
