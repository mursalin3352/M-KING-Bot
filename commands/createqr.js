'use strict';

async function createqrCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const data = text.split(' ').slice(1).join(' ').trim();
        
        if (!data) {
            return sock.sendMessage(chatId, {
                text: '📱 *QR CODE GENERATOR*\n\nUsage: $createqr <text or URL>\nExample: $createqr https://youtube.com\nExample: $createqr Hello M-KING',
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, { text: '📱 _Generating QR...' }, { quoted: message });

        // Direct working QR API - no gifted lib needed
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=800x800&data=${encodeURIComponent(data)}`;

        await sock.sendMessage(chatId, {
            image: { url: qrUrl },
            caption: `📱 *QR CODE CREATED*\n\n▸ 🔤 *Data:* ${data.slice(0, 100)}${data.length > 100 ? '...' : ''}\n\n_M-KING_ ⚡`,
        }, { quoted: message });

    } catch (err) {
        console.error('[createqr]', err);
        await sock.sendMessage(chatId, { text: '❌ QR code generation failed. Try again.' }, { quoted: message });
    }
}

module.exports = createqrCommand;
