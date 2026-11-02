'use strict';

async function createqrCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const data = text.split(' ').slice(1).join(' ').trim();
        
        if (!data) {
            return sock.sendMessage(chatId, {
                text: `╭─『 📱 QR CODE 』─╮\n│\n│ ❐ Usage: $createqr <text>\n│ ❐ Example: $createqr https://youtube.com\n│\n╰─『 M-KING👑 』─╯`,
            }, { quoted: message });
        }

        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=800x800&data=${encodeURIComponent(data)}`;

        await sock.sendMessage(chatId, {
            image: { url: qrUrl },
            caption: `╭─『 📱 QR CODE 』─╮\n│\n│ ❐ Data: ${data.slice(0, 70)}${data.length > 70 ? '...' : ''}\n│\n╰─『 M-KING👑 』─╯`,
        }, { quoted: message });

    } catch (err) {
        console.error('[createqr]', err);
        await sock.sendMessage(chatId, { 
            text: `╭─『 ❌ ERROR 』─╮\n│ QR Failed\n╰─『 M-KING👑 』─╯` 
        }, { quoted: message });
    }
}

module.exports = createqrCommand;
