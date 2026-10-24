'use strict';

async function ppCommand(sock, chatId, message) {
    try {
        const rawText = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const args = rawText.replace(/^\$pp\s*/i, '').trim();
        const ctx = message.message?.extendedTextMessage?.contextInfo || {};

        let targetJid = null;

        // 1. TAG kiya ho - $pp @user
        if (ctx.mentionedJid && ctx.mentionedJid[0]) {
            targetJid = ctx.mentionedJid[0];
        }
        // 2. REPLY kiya ho - kisi message ko reply karke $pp
        else if (ctx.participant) {
            targetJid = ctx.participant;
        }
        // 3. NUMBER diya ho - $pp 923001234567
        else if (args && /^\+?\d{7,15}$/.test(args.replace(/\s/g, ''))) {
            let num = args.replace(/[^0-9]/g, '');
            // Pakistan number 03 se start ho to 92 lagao
            if (num.startsWith('0')) num = '92' + num.substring(1);
            targetJid = `${num}@s.whatsapp.net`;
        }
        // 4. APNI DP - $pp
        else {
            targetJid = message.key.participant || message.key.remoteJid;
        }

        targetJid = targetJid.replace(/:\d+@/g, '@');

        // DP nikalo
        const ppUrl = await sock.profilePictureUrl(targetJid, 'image');
        
        const number = targetJid.split('@')[0];
        const caption = `╭━━━「 *PROFILE PICTURE* 」━━━\n┃\n┃ 👤 *Number:* ${number}\n┃ 🔗 *JID:* ${targetJid}\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━\n> _Powered by M-KING👑_`;

        await sock.sendMessage(chatId, {
            image: { url: ppUrl },
            caption: caption
        }, { quoted: message });

    } catch (err) {
        console.error('[pp]', err.message);
        await sock.sendMessage(chatId, { 
            text: `❌ *DP nahi mili*\n\nReason: ${err.message}\n\n*Try:*\n$pp - Apni DP\n$pp @tag - Tag ki DP\nReply karke $pp - Reply wale ki DP\n$pp 9230xxxxxxx - Number ki DP` 
        }, { quoted: message });
    }
}

module.exports = ppCommand;
