const { isJidGroup } = require('@whiskeysockets/baileys');
const { getAntilink, incrementWarningCount, resetWarningCount, isSudo } = require('./index');
const isAdmin = require('./isAdmin');
const config = require('../config');

const WARN_COUNT = config.WARN_COUNT || 3;

function containsURL(str) {
    if (!str || typeof str !== 'string') return false;
    const urlPatterns = [
        /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/i,
        /www\.[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/i,
        /([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/[^\s]*)?/i,
        /chat\.whatsapp\.com\/[A-Za-z0-9]{20,}/i,
        /wa\.me\/channel\/[A-Za-z0-9]{20,}/i,
        /t\.me\/[A-Za-z0-9_]+/i,
        /discord\.gg\/[A-Za-z0-9]+/i,
        /discord\.com\/invite\/[A-Za-z0-9]+/i
    ];
    return urlPatterns.some(pattern => pattern.test(str));
}

async function Antilink(msg, sock) {
    try {
        const jid = msg.key.remoteJid;
        if (!isJidGroup(jid)) return;

        const SenderMessage = msg.message?.conversation || 
                            msg.message?.extendedTextMessage?.text ||
                            msg.message?.imageMessage?.caption ||
                            msg.message?.videoMessage?.caption ||
                            msg.message?.documentMessage?.caption ||
                            '';
        
        if (!SenderMessage || typeof SenderMessage !== 'string') return;
        const sender = msg.key.participant;
        if (!sender) return;

        // --- ADMIN & SUDO CHECK ---
        try {
            const adminCheck = await isAdmin(sock, jid, sender);
            if (adminCheck?.isSenderAdmin) return; // Admin ko ignore
            if (!adminCheck?.isBotAdmin) return; // Bot admin nahi to kuch mat kar
        } catch (e) {
            console.error('[ANTILINK] Admin check error:', e);
            return;
        }
        
        if (await isSudo(sender)) return;

        if (!containsURL(SenderMessage.trim())) return;
        
        const antilinkConfig = await getAntilink(jid, 'on');
        if (!antilinkConfig || !antilinkConfig.enabled) return;

        const action = antilinkConfig.action || 'delete';
        
        // Message Delete
        try {
            await sock.sendMessage(jid, { delete: msg.key });
        } catch (e) {
            console.log('[ANTILINK] Delete fail:', e.message);
        }

        // --- PREMIUM ACTIONS WITH EMOJI & SHOW ---
        switch (action) {
            case 'delete':
                await sock.sendMessage(jid, {
                    text: `╔═══『 🚫 *LINK PROTECTION* 🔗 』═══╗\n║ 👤 @${sender.split('@')[0]}\n║ ❌ Not Allowed! 🔗\n║ 🗑️ Link Deleted Successfully ✅\n║ 🙏 Links are not allowed here\n╚════『 👑 M-KING 』════╝`,
                    mentions: [sender]
                });
                break;

            case 'kick':
                try {
                    await sock.groupParticipantsUpdate(jid, [sender], 'remove');
                    await sock.sendMessage(jid, {
                        text: `╔═══『 🦶 *KICKED* 🔗 』═══╗\n║ 👤 @${sender.split('@')[0]}\n║ ❌ Sent forbidden link 🔗\n║ 🦶 Kicked from group 🚪\n╚════『 👑 M-KING 』════╝`,
                        mentions: [sender]
                    });
                } catch (kickError) {
                    console.error('[ANTILINK] Kick fail:', kickError);
                }
                break;

            case 'warn':
                try {
                    const warningCount = await incrementWarningCount(jid, sender);
                    if (warningCount >= WARN_COUNT) {
                        await sock.groupParticipantsUpdate(jid, [sender], 'remove');
                        await resetWarningCount(jid, sender);
                        await sock.sendMessage(jid, {
                            text: `╔═══『 ⚠️ *FINAL WARNING* 🦶 』═══╗\n║ 👤 @${sender.split('@')[0]}\n║ 🔗 Link Sent ${WARN_COUNT}/${WARN_COUNT}\n║ 🦶 Kicked After Warnings 🚪\n╚════『 👑 M-KING 』════╝`,
                            mentions: [sender]
                        });
                    } else {
                        await sock.sendMessage(jid, {
                            text: `╔═══『 ⚠️ *WARNING* 🔗 』═══╗\n║ 👤 @${sender.split('@')[0]}\n║ 🔗 Link Detected! ❌\n║ ⚠️ Warning: ${warningCount}/${WARN_COUNT} ⚠️\n║ 🙏 Please avoid links\n╚════『 👑 M-KING 』════╝`,
                            mentions: [sender]
                        });
                    }
                } catch (warnError) {
                    console.error('[ANTILINK] Warn fail:', warnError);
                }
                break;
        }
    } catch (error) {
        console.error('[ANTILINK] Main Error:', error);
    }
}

module.exports = { Antilink, containsURL };
