const settings = require('../settings');
const os = require('os');

async function aliveCommand(sock, chatId, message) {
    try {
        const t = process.uptime();
        const h = Math.floor(t / 3600);
        const m = Math.floor((t % 3600) / 60);
        const s = Math.floor(t % 60);
        const ver = settings.version || '1.0.0';
        const mode = settings.commandMode || 'public';
        
        // Real System Data
        const ramUsed = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        const ramTotal = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
        const heapTotal = (process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2);
        const freeMem = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);

        const msg = 
`╭──⊷❍ 𝐌-𝐊𝐈𝐍𝐆 𝐒𝐓𝐀𝐓𝐔𝐒 ❍⊷─╮
│ ╭────────────
│ │❁➟ 🤖 𝐁𝐎𝐓: M-KING👑 
│ │❁➟ ✅ 𝐒𝐓𝐀𝐓𝐔𝐒: Online
│ │❁➟ ⏱️ 𝐔𝐏𝐓𝐈𝐌𝐄: ${h}h ${m}m ${s}s
│ │❁➟ 🔧 𝐕𝐄𝐑𝐒𝐈𝐎𝐍: v${ver}
│ │❁➟ ⚙️ 𝐌𝐎𝐃𝐄: ${mode}
│ ┗─────────────
┗───────────⊷❍➟

╭──⊷❍ 𝐒𝐘𝐒𝐓𝐄𝐌 𝐈𝐍𝐅𝐎 ❍⊷─╮
│ ╭────────────
│ │❁➟ 💾 𝐑𝐀𝐌: ${ramUsed} MB / ${ramTotal} GB
│ │❁➟ 🆓 𝐅𝐑𝐄𝐄: ${freeMem} GB
│ │❁➟ 📦 𝐇𝐄𝐀𝐏: ${ramUsed} MB / ${heapTotal} MB
│ ┗─────────────
┗───────────⊷❍➟

╭──⊷❍ 𝐄𝐍𝐕𝐈𝐑𝐎𝐍𝐌𝐄𝐍𝐓 ❍⊷─╮
│ ╭────────────
│ │❁➟ 🐧 𝐎𝐒: ${os.type()} ${os.arch()}
│ │❁➟ 📗 𝐍𝐎𝐃𝐄: ${process.version}
│ │❁➟ 🔧 𝐂𝐏𝐔: ${os.cpus()[0].model}
│ ┗─────────────
┗───────────⊷❍➟

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
