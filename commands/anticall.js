const fs = require('fs');

const ANTICALL_PATH = './data/anticall.json';

function readState() {
    try {
        if (!fs.existsSync(ANTICALL_PATH)) return { enabled: false };
        const raw = fs.readFileSync(ANTICALL_PATH, 'utf8');
        const data = JSON.parse(raw || '{}');
        return { enabled: !!data.enabled };
    } catch {
        return { enabled: false };
    }
}

function writeState(enabled) {
    try {
        if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });
        fs.writeFileSync(ANTICALL_PATH, JSON.stringify({ enabled: !!enabled }, null, 2));
    } catch {}
}

async function anticallCommand(sock, chatId, message, args) {
    const state = readState();
    const sub = (args || '').trim().toLowerCase();

    if (!sub || (sub !== 'on' && sub !== 'off' && sub !== 'status')) {
        const menu = 
`╔══════════════════════════╗
║   📵  ᴀɴᴛɪ-ᴄᴀʟʟ ᴄᴇɴᴛʀᴇ  📵   ║
╚══════════════════════════╝

┏━━━━━━━━━━━━━━━━━━━━━━┓
┃ ⚙️  𝙎𝙀𝙏𝙐𝙋 𝙈𝙀𝙉𝙐
┣━━━━━━━━━━━━━━━━━━━━━━┫
┃ 📵 .ᴀɴᴛɪᴄᴀʟʟ ᴏɴ ➔ 🟢 Enable
┃ 🔰 .ᴀɴᴛɪᴄᴀʟʟ ᴏғғ ➔ 🔴 Disable
┃ 📊 .ᴀɴᴛɪᴄᴀʟʟ ꜱᴛᴀᴛᴜꜱ ➔ 📖 Status
┗━━━━━━━━━━━━━━━━━━━━━━┛

💡 Auto reject incoming calls 🚫📞

╰─► 👑 𝙈-𝙆𝙄𝙉𝙂 𝘽𝙊𝙏 👑 ◄─╯`;
        await sock.sendMessage(chatId, { text: menu }, { quoted: message });
        return;
    }

    if (sub === 'status') {
        await sock.sendMessage(chatId, { 
            text: `╔═══『 📊 *ANTICALL STATUS* 📵 』═══╗\n║\n║ ${state.enabled ? '🟢 Status: *ON ✅*\n║ 📵 Calls will be Rejected 🚫' : '🔴 Status: *OFF ❌*\n║ 💤 Calls will be Allowed'}\n║\n╚════『 👑 M-KING 』════╝` 
        }, { quoted: message });
        return;
    }

    const enable = sub === 'on';
    writeState(enable);
    await sock.sendMessage(chatId, { 
        text: enable ? `╔═══『 🛡️ *ANTICALL ON* 🟢 』═══╗\n║ 📵 Anticall *ENABLED* ✅\n║ 🚫 All Calls will be Rejected\n╚════『 👑 M-KING 』════╝` : `╔═══『 🚫 *ANTICALL OFF* 🔴 』═══╗\n║ 💤 Anticall *DISABLED* ❌\n║ 📞 Calls will be Allowed\n╚════『 👑 M-KING 』════╝` 
    }, { quoted: message });
}

module.exports = { anticallCommand, readState };
