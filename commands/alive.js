const settings = require('../settings');

async function aliveCommand(sock, chatId, message) {
    try {
        const t = process.uptime();
        const h = Math.floor(t / 3600);
        const m = Math.floor((t % 3600) / 60);
        const s = Math.floor(t % 60);
        const ver = settings.version || '1.0.0';
        const mode = settings.commandMode || 'public';

        const msg = 
`╭──⊷❍ 𝐌-𝐊𝐈𝐍𝐆 𝐒𝐔𝐂𝐂𝐄𝐒𝐒 ❍⊷─╮
│ ╭────────────
│ │❁➟ ✅ 𝐌-𝐊𝐈𝐍𝐆 𝐁𝐎𝐓 is online.
│ │❁➟ ✅ Status: Online
│ │❁➟ ⏱️ Uptime: ${h}h ${m}m ${s}s
│ │❁➟ 🔧 Version: v${ver}
│ │❁➟ ⚙️ Mode: ${mode}
│ ┗─────────────
┗───────────⊷❍➟

🎬 Movie search  →  $movie
🤖 AI assistant  →  $gpt
📋 All commands  →  $menu

> 𝐏𝐎𝐖𝐄𝐑𝐄𝐃 𝐁𝐘 𝐌𝐮𝐫𝐬𝐚𝐥𝐢𝐧-𝐊𝐢𝐧𝐠👑`;

        await sock.sendMessage(chatId, { text: msg }, { quoted: message });
    } catch (error) {
        console.error('Error in alive command:', error);
        await sock.sendMessage(chatId, { text: '✅ M-KING is alive and running! | POWERED BY 👑 Mursalin-King👑' }, { quoted: message });
    }
}

async function communityCommand(sock, chatId, message) {
    await sock.sendMessage(chatId, {
        text:
            `👥 *M-KING COMMUNITY*\n\n` +
            `Join our WhatsApp community to get updates, tips, and connect with other users!\n\n` +
            `> 𝐏𝐎𝐖𝐄𝐑𝐄𝐃 𝐁𝐘 𝐌𝐮𝐫𝐬𝐚𝐥𝐢𝐧-𝐊𝐢𝐧𝐠👑`,
    }, { quoted: message });
}

module.exports = { aliveCommand, communityCommand };
