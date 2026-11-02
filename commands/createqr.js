'use strict';

async function createqrCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const data = text.split(' ').slice(1).join(' ').trim();
        
        if (!data) {
            return sock.sendMessage(chatId, {
                text: `╭─『 📱 QR CODE 』─╮\n│ ❌ Action: No Data\n│ 📚 Usage: $createqr <text>\n│ 🔒 Mode: Waiting\n╰─『 M-KING👑 』─╯`,
            }, { quoted: message });
        }

        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=800x800&data=${encodeURIComponent(data)}`;

        await sock.sendMessage(chatId, {
            image: { url: qrUrl },
            caption: `╭─『 📱 QR CODE 』─╮\n│ 🟢 Status: Created\n│ 📦 Data: ${data.slice(0, 50)}${data.length > 50 ? '...' : ''}\n│ 🔒 Mode: Ready To Scan\n╰─『 M-KING👑 』─╯`,
        }, { quoted: message });

    } catch (err) {
        console.error('[createqr]', err);
        await sock.sendMessage(chatId, { 
            text: `╭─『 ❌ ERROR 』─╮\n│ 🟢 Status: Failed\n│ 🔒 Mode: Error\n╰─『 M-KING👑 』─╯` 
        }, { quoted: message });
    }
}

module.exports = createqrCommand;
