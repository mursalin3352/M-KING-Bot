'use strict';

const fs   = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../lib/isOwner');
const { isAuthorizedOwnerSession } = require('../lib/isOwner');
const { WAMessageStubType } = require('@whiskeysockets/baileys');

const DATA_DIR    = path.join(__dirname, '../data');
const CONFIG_PATH = path.join(DATA_DIR, 'antimedia.json');

function loadConfig() {
    try {
        if (!fs.existsSync(CONFIG_PATH)) return {};
        const raw = fs.readFileSync(CONFIG_PATH, 'utf8').trim();
        return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
}
function saveConfig(cfg) {
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
    } catch (e) {
        console.error('[antigroupmention/saveConfig]', e.message);
    }
}
function getGroupConfig(groupId) {
    return loadConfig()[groupId] || {};
}
function setGroupFlags(groupId, updates) {
    const c = loadConfig();
    if (!c[groupId]) c[groupId] = {};
    Object.assign(c[groupId], updates);
    saveConfig(c);
}

async function checkAuth(sock, chatId, senderId, message) {
    if (!chatId.endsWith('@g.us')) {
        await sock.sendMessage(chatId, { text: '╭━━━〔 ❌ 𝙀𝙍𝙍𝙊𝙍 〕━━━╮\n┃ ɢʀᴏᴜᴘ-ᴏɴʟʏ ᴄᴏᴍᴍᴀɴᴅ ʜᴀɪ ʙᴀʙʏ 💔\n╰━━━━━━━━━━━━━━━━━╯' }, { quoted: message });
        return false;
    }
    if (isAuthorizedOwnerSession(sock) &&
        (message.key.fromMe || await isOwnerOrSudo(senderId, sock, chatId))) return true;
    try {
        const meta = await sock.groupMetadata(chatId);
        if (meta.participants.some(p => p.id === senderId && p.admin)) return true;
    } catch {}
    await sock.sendMessage(chatId, { text: '╭━━━〔 🔒 ᴀᴅᴍɪɴ ᴏɴʟʏ 〕━━━╮\n┃ sɪʀғ ᴀᴅᴍɪɴ ᴜsᴇ ᴋᴀʀ sᴋᴛᴇ ʜᴀɪɴ 👑\n╰━━━━━━━━━━━━━━━━━╯' }, { quoted: message });
    return false;
}

async function antigroupmentionCommand(sock, chatId, senderId, message) {
    if (!await checkAuth(sock, chatId, senderId, message)) return;

    const raw  = (message.message?.conversation || message.message?.extendedTextMessage?.text || '').trim();
    const args = raw.split(/\s+/).slice(1).map(a => a.toLowerCase());
    const sub  = args[0];

    const cfg    = getGroupConfig(chatId);
    const isOn   = !!cfg.antigroupmention;
    const action = cfg.antigroupmentionAction || 'delete';

    if (!sub || sub === 'get' || sub === 'status') {
        return sock.sendMessage(chatId, {
            text: `╔══════════════════════════╗
║  🔇 ᴀɴᴛɪ sᴛᴀᴛᴜs ᴍᴇɴᴛɪᴏɴ 🔇  ║
╚══════════════════════════╝

┏━━━━━━━━━━━━━━━━━━━━━━┓
┃ 📊 *ᴄᴜʀʀᴇɴᴛ sᴛᴀᴛᴜs*
┣━━━━━━━━━━━━━━━━━━━━━━┫
┃ ${isOn ? '🟢 ᴇɴᴀʙʟᴇᴅ ✅' : '🔴 ᴅɪsᴀʙʟᴇᴅ ❌'}
┃ ⚙️ ᴀᴄᴛɪᴏɴ: *${action.toUpperCase()}* ${action === 'kick' ? '🦶' : '🗑️'}
┗━━━━━━━━━━━━━━━━━━━━━━┛

┏━━━━━━━━『 ✨ 𝙈𝙀𝙉𝙐 ✨ 』━━━━━━━━┓
┃ 🎀 $ᴀɴᴛɪɢʀᴏᴜᴘᴍᴇɴᴛɪᴏɴ ᴏɴ ➔ 🟢
┃ 🥀 $ᴀɴᴛɪɢʀᴏᴜᴘᴍᴇɴᴛɪᴏɴ ᴏғғ ➔ 🔴
┃ 🗑️ $ᴀɢᴍ sᴇᴛ ᴅᴇʟᴇᴛᴇ ➔ 🧹
┃ 🦶 $ᴀɢᴍ sᴇᴛ ᴋɪᴄᴋ ➔ 🚫
┃ 📖 $ᴀɢᴍ ɢᴇᴛ ➔ 📊
┗━━━━━━━━━━━━━━━━━━━━━━┛

💡 sᴛᴀᴛᴜs ᴍᴇ ɢʀᴏᴜᴘ ᴛᴀɢ ɴᴏᴛ ᴀʟʟᴏᴡᴇᴅ 🔒

╰─► 👑 𝙈-𝙆𝙄𝙉𝙂👑 ◄─╯`
        }, { quoted: message });
    }

    if (sub === 'on') {
        if (isOn) return sock.sendMessage(chatId, { text: '╔═══『 ⚠️ ᴀʟʀᴇᴀᴅʏ ᴏɴ 』═══╗\n║ 🟢 ᴀʟʀᴇᴀᴅʏ ᴇɴᴀʙʟᴇᴅ ʜᴀɪ ✨\n╚════『 👑 M-KING 』════╝' }, { quoted: message });
        setGroupFlags(chatId, { antigroupmention: true, antigroupmentionAction: action });
        return sock.sendMessage(chatId, {
            text: `╔═══『 🛡️ ᴇɴᴀʙʟᴇᴅ 🟢 』═══╗\n║ ✅ ᴀɴᴛɪ sᴛᴀᴛᴜs ᴍᴇɴᴛɪᴏɴ *ON* 💖\n║ ⚙️ ᴀᴄᴛɪᴏɴ: *${action}* ${action === 'kick' ? '🦶' : '🗑️'}\n╚════『 👑 M-KING 』════╝`
        }, { quoted: message });
    }

    if (sub === 'off') {
        if (!isOn) return sock.sendMessage(chatId, { text: '╔═══『 ⚠️ ᴀʟʀᴇᴀᴅʏ ᴏғғ 』═══╗\n║ 🔴 ᴀʟʀᴇᴀᴅʏ ᴏғғ ʜᴀɪ 💔\n╚════『 👑 M-KING 』════╝' }, { quoted: message });
        setGroupFlags(chatId, { antigroupmention: false });
        return sock.sendMessage(chatId, { text: `╔═══『 🔴 ᴅɪsᴀʙʟᴇᴅ 』═══╗\n║ 💤 *OFF* ʜᴏ ɢʏᴀ 🥀\n╚════『 👑 M-KING 』════╝` }, { quoted: message });
    }

    if (sub === 'set') {
        const newAction = args[1];
        if (!newAction || !['delete', 'kick'].includes(newAction)) {
            return sock.sendMessage(chatId, {
                text: `╔═══『 ❌ ɪɴᴠᴀʟɪᴅ 』═══╗\n║ ⚙️ Usᴇ:\n║ 🗑️ $ᴀɢᴍ sᴇᴛ ᴅᴇʟᴇᴛᴇ\n║ 🦶 $ᴀɢᴍ sᴇᴛ ᴋɪᴄᴋ\n╚════『 👑 M-KING 』════╝`
            }, { quoted: message });
        }
        setGroupFlags(chatId, { antigroupmentionAction: newAction, antigroupmention: true });
        return sock.sendMessage(chatId, {
            text: `╔═══『 ✅ sᴇᴛ ᴅᴏɴᴇ 』═══╗\n║ ⚙️ sᴇᴛ ᴛᴏ *${newAction.toUpperCase()}* ${newAction === 'kick' ? '🦶' : '🗑️'}\n║ 🟢 ᴀᴜᴛᴏ ᴇɴᴀʙʟᴇᴅ ✅\n╚════『 👑 M-KING 』════╝`
        }, { quoted: message });
    }

    return sock.sendMessage(chatId, { text: `❓ Unknown option. Use *$agm* to see menu 🎀\n\n👑 M-KING 👑` }, { quoted: message });
}

function isGroupStatusMention(message) {
    if (message.isMentionedInStatus === true) return true;
    const stubType = message.messageStubType;
    if (
        stubType === 210 ||
        stubType === 'STATUS_MENTION' ||
        (WAMessageStubType && stubType === WAMessageStubType.STATUS_MENTION)
    ) return true;
    const msg = message.message;
    if (!msg) return false;
    if (msg.groupStatusMentionMessage) return true;
    if (msg.groupMentionedMessage)     return true;
    if (msg.statusMentionMessage)      return true;
    const inner =
        msg.ephemeralMessage?.message         ||
        msg.viewOnceMessage?.message          ||
        msg.viewOnceMessageV2?.message        ||
        msg.documentWithCaptionMessage?.message;
    if (inner) {
        if (inner.groupStatusMentionMessage) return true;
        if (inner.groupMentionedMessage)     return true;
        if (inner.statusMentionMessage)      return true;
    }
    return false;
}

function extractSenderJid(message) {
    const kp = message.key?.participant;
    if (kp && !kp.endsWith('@g.us')) return kp;
    const params = message.messageStubParameters || [];
    if (params.length > 0) {
        const p = params[0];
        if (typeof p === 'string' && p.length > 0) {
            if (!p.endsWith('@g.us')) {
                return p.includes('@') ? p : `${p}@s.whatsapp.net`;
            }
        }
    }
    const mp = message.participant;
    if (mp && !mp.endsWith('@g.us')) return mp;
    return null;
}

async function handleAntigroupmentionMessage(sock, message) {
    try {
        const chatId = message.key?.remoteJid;
        if (!chatId?.endsWith('@g.us')) return;
        const cfg = getGroupConfig(chatId);
        if (!cfg.antigroupmention) return;
        if (!isGroupStatusMention(message)) return;
        const senderId = extractSenderJid(message);
        if (!senderId) return;
        const botNum = sock.user?.id?.split(':')[0]?.split('@')[0] || '';
        const senderNum = senderId.split(':')[0].split('@')[0];
        if (botNum && senderNum === botNum) return;
        try {
            const meta = await sock.groupMetadata(chatId);
            const member = meta.participants.find(p => p.id.split(':')[0].split('@')[0] === senderNum);
            if (member?.admin) return;
        } catch { return; }
        if (await isOwnerOrSudo(senderId, sock, chatId)) return;
        const action = cfg.antigroupmentionAction || 'delete';
        try {
            await sock.sendMessage(chatId, {
                delete: { remoteJid: chatId, fromMe: false, id: message.key.id, participant: senderId },
            });
        } catch {}
        const tag = `@${senderNum}`;
        if (action === 'kick') {
            try {
                await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');
                await sock.sendMessage(chatId, {
                    text: `╔═══『 🚫 ᴀɴᴛɪ sᴛᴀᴛᴜs ᴍᴇɴᴛɪᴏɴ 🦶 』═══╗\n║ ${tag} ᴋᴏ ᴋɪᴄᴋ ᴋᴀʀ ᴅɪʏᴀ 🚫\n║ 📵 sᴛᴀᴛᴜs ᴍᴇ ɢʀᴏᴜᴘ ᴛᴀɢ ᴋɪʏᴀ ᴛʜᴀ 💔\n╚════『 👑 M-KING 』════╝`,
                    mentions: [senderId],
                });
            } catch {}
        } else {
            await sock.sendMessage(chatId, {
                text: `╔═══『 ⚠️ ᴀɴᴛɪ sᴛᴀᴛᴜs ᴍᴇɴᴛɪᴏɴ 🗑️ 』═══╗\n║ ${tag} ʙᴀʙʏ, sᴛᴀᴛᴜs ᴍᴇ ɢʀᴏᴜᴘ ᴛᴀɢ ᴀʟʟᴏᴡ ɴᴀʜɪ 🥀\n║ 🧹 ᴅᴇʟᴇᴛᴇ ᴋᴀʀ ᴅɪʏᴀ ✅\n╚════『 👑 M-KING 』════╝`,
                mentions: [senderId],
            });
        }
    } catch (err) {
        console.error('[antigroupmention/detect]', err.message);
    }
}

module.exports = { antigroupmentionCommand, handleAntigroupmentionMessage };
