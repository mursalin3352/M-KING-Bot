'use strict';

const fs   = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../lib/isOwner');
const { isAuthorizedOwnerSession } = require('../lib/isOwner');

const CONFIG_PATH = path.join(__dirname, '../data/antileave.json');

function loadConfig() {
    try {
        if (!fs.existsSync(CONFIG_PATH)) return {};
        return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch { return {}; }
}
function saveConfig(cfg) {
    try { 
        const dir = path.dirname(CONFIG_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2)); 
    }
    catch (err) { console.error('[antileave] config save:', err.message); }
}
function isEnabled(groupId) {
    return !!loadConfig()[groupId]?.enabled;
}

async function handleAntiLeaveCommand(sock, chatId, senderId, message) {
    if (!chatId.endsWith('@g.us')) {
        return sock.sendMessage(chatId,
            { text: '╭━━━〔 ❌ ERROR 〕━━━╮\n┃ Group-Only Baby 💔\n╰━━━━━━━━━━━━━╯' },
            { quoted: message });
    }

    const isOwner = isAuthorizedOwnerSession(sock) &&
        (message.key.fromMe || await isOwnerOrSudo(senderId, sock, chatId));

    let isAdmin = false;
    try {
        const meta = await sock.groupMetadata(chatId);
        const me   = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        isAdmin = meta.participants.some(
            p => (p.id === senderId || p.id === me) && p.admin
        );
    } catch {}

    if (!isOwner && !isAdmin) {
        return sock.sendMessage(chatId,
            { text: '╭━━━〔 🔒 ADMIN ONLY 〕━━━╮\n┃ Sirf Admin 👑\n╰━━━━━━━━━━━━━╯' },
            { quoted: message });
    }

    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const match = text.split(' ').slice(1).join(' ').trim().toLowerCase();
    const cfg   = loadConfig();

    if (!match || match === 'status' || match === 'get') {
        const on = !!cfg[chatId]?.enabled;
        return sock.sendMessage(chatId, {
            text: `╔══════════════════════════╗
║   🚪 𝗔𝗡𝗧𝗜-𝗟𝗘𝗔𝗩𝗘 𝗦𝗬𝗦𝗧𝗘𝗠 🚪   ║
╚══════════════════════════╝

┏━━━━━━━━━━━━━━━━━━━━━━┓
┃ 📊 𝐒𝐓𝐀𝐓𝐔𝐒
┣━━━━━━━━━━━━━━━━━━━━━━┫
┃ ${on ? '🟢 Enabled ✅ ✨' : '🔴 Disabled ❌ 💤'}
┗━━━━━━━━━━━━━━━━━━━━━━┛

┏━━━━━━━━『 ✨ MENU ✨ 』━━━━━━━━┓
┃ 🎀 $antileave on ➔ 🟢 Active
┃ 🥀 $antileave off ➔ 🔴 Deactive
┃ 📖 $antileave status ➔ 📊
┗━━━━━━━━━━━━━━━━━━━━━━┛

💡 Leave Pe Auto Farewell Msg 📢

╰─► 👑 𝙼-𝙺𝙸𝙽G👑 ◄─╯`
        }, { quoted: message });
    }

    if (match === 'on') {
        if (cfg[chatId]?.enabled)
            return sock.sendMessage(chatId, { text: '╔═══『 ⚠️ ALREADY ON 』═══╗\n║ 🟢 Already Enabled ✨\n╚════『 👑 M-KING 』════╝' }, { quoted: message });
        cfg[chatId] = { enabled: true };
        saveConfig(cfg);
        return sock.sendMessage(chatId, {
            text: `╔═══『 🟢 ENABLED ✅ 』═══╗\n║ 🚪 Anti-Leave *ON* Ho Gya 💖\n║ 📢 Ab Leave Pe Msg Ayega 🥺\n╚════『 👑 M-KING 』════╝`
        }, { quoted: message });
    }

    if (match === 'off') {
        if (!cfg[chatId]?.enabled)
            return sock.sendMessage(chatId, { text: '╔═══『 ⚠️ ALREADY OFF 』═══╗\n║ 🔴 Already Off 💔\n╚════『 👑 M-KING 』════╝' }, { quoted: message });
        cfg[chatId] = { enabled: false };
        saveConfig(cfg);
        return sock.sendMessage(chatId, {
            text: `╔═══『 🔴 DISABLED 💤 』═══╗\n║ 🚪 Anti-Leave *OFF* Ho Gya 🥀\n╚════『 👑 M-KING 』════╝`
        }, { quoted: message });
    }

    return sock.sendMessage(chatId,
        { text: '╭━━━〔 ❓ ERROR 〕━━━╮\n┃ Use: $antileave on/off 🎀\n╰━━━━━━━━━━━━━╯' },
        { quoted: message });
}

async function handleAntiLeave(sock, groupId, participants) {
    try {
        if (!isEnabled(groupId)) return;

        let groupName = 'this group';
        try {
            const meta = await sock.groupMetadata(groupId);
            groupName = meta.subject;
        } catch {}

        for (const jid of participants) {
            const clean = jid.replace(/:\d+@/, '@');
            const num   = clean.split('@')[0];
            const tag = `@${num}`;

            await sock.sendMessage(groupId, {
                text: `╔═══════════════════════════╗
║   💔 𝗦𝗢𝗠𝗘𝗢𝗡𝗘 𝗟𝗘𝗙𝗧 💔   ║
╚═══════════════════════════╝

┏━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 👤 𝐔𝐒𝐄𝐑: ${tag}
┃ 🏰 𝐆𝐑𝐎𝐔𝐏: ${groupName}
┣━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 🥀 𝐒𝐓𝐀𝐓𝐔𝐒: Left The Group 🚪
┃ 💬 𝐌𝐒𝐆: Goodbye, We Will Miss You 😢
┃ ⏰ 𝐓𝐈𝐌𝐄: ${new Date().toLocaleTimeString()}
┗━━━━━━━━━━━━━━━━━━━━━━━━┛

𝘌𝘷𝘦𝘳𝘺 𝘭𝘦𝘢𝘷𝘦 𝘩𝘢𝘴 𝘢 𝘴𝘵𝘰𝘳𝘺... 📖
𝘚𝘰𝘮𝘦𝘵𝘪𝘮𝘦𝘴 𝘨𝘰𝘰𝘥𝘣𝘺𝘦 𝘪𝘴 𝘵𝘩𝘦 𝘣𝘦𝘴𝘵 💫

╰─► 👑 𝙼-𝙺𝙸𝙽𝙶👑 ◄─╯`,
                mentions: [clean]
            });
        }
    } catch (err) {
        console.error('[antileave]', err.message);
    }
}

module.exports = { handleAntiLeaveCommand, handleAntiLeave };
