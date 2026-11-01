'use strict';
const { get } = require('../lib/gifted');

async function apkCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const query = text.split(' ').slice(1).join(' ').trim();
        if (!query) {
            return sock.sendMessage(chatId, { text: '╭━━━「 📲 𝐀𝐏𝐊 」━━━\n┃\n┃ Usage: $apk <app name>\n┃ Example: $apk WhatsApp\n┃\n╰━━━━━━━━━━━━━━━━━━━━━\n\n𝗠-𝗞𝗜𝗡𝗚👑' }, { quoted: message });
        }
        await sock.sendMessage(chatId, { text: `📲 Searching APK: *${query}*...\n\n𝗠-𝗞𝗜𝗡𝗚👑` }, { quoted: message });
        const data = await get('/download/apkdl', { appName: query });
        if (!data?.success || !data?.result?.download_url) {
            return sock.sendMessage(chatId, { text: '🚫 App not found or failed to fetch APK. Try a different name.\n\n𝗠-𝗞𝗜𝗡𝗚👑' }, { quoted: message });
        }
        const r = data.result;
        const caption =
            `╭━━━「 📦 𝐀𝐏𝐊 𝐅𝐎𝐔𝐍𝐃 」━━━\n` +
            `┃\n` +
            `┃ 📂 𝐀𝐩𝐩: ${r.appname || query}\n` +
            `┃ 👨‍💻 𝐃𝐞𝐯: ${r.developer || 'Unknown'}\n` +
            `┃ 📦 𝐒𝐢𝐳𝐞: ${r.size || 'Unknown'}\n` +
            `┃\n` +
            `╰━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `𝗠-𝗞𝗜𝗡𝗚👑`;
        if (r.appicon) {
            await sock.sendMessage(chatId, { image: { url: r.appicon }, caption }, { quoted: message });
        }
        await sock.sendMessage(chatId, {
            document: { url: r.download_url },
            mimetype: r.mimetype || 'application/vnd.android.package-archive',
            fileName: `${r.appname || query}.apk`,
            caption: '✅ *Use at your own risk.*\n\n𝗠-𝗞𝗜𝗡𝗚👑',
        }, { quoted: message });
    } catch (err) {
        console.error('[apk]', err.message);
        await sock.sendMessage(chatId, { text: '❌ APK download failed. Try again.\n\n𝗠-𝗞𝗜𝗡𝗚👑' }, { quoted: message });
    }
}

module.exports = apkCommand;
