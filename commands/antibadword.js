'use strict';
const { handleAntiBadwordCommand, handleBadwordDetection } = require('../lib/antibadword');

async function antibadwordCommand(sock, chatId, message, senderId, isSenderAdmin) {
    try {
        const isOwner = message.key.fromMe;
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const match = text.replace(/^\S+\s*/, '').trim().toLowerCase();
        const sub = match.split(/\s+/)[0];

        const isPublic = ['list', 'test'].includes(sub);

        if (!isPublic && !isSenderAdmin && !isOwner) {
            return sock.sendMessage(chatId, { text: '```For Group Admins or Bot Owner Only!```' }, { quoted: message });
        }

        await handleAntiBadwordCommand(sock, chatId, message, match, senderId, !!isSenderAdmin);
    } catch (e) {
        console.error('Error in antibadword command:', e);
        await sock.sendMessage(chatId, { text: '*Error processing command*' }, { quoted: message });
    }
}

module.exports = antibadwordCommand;
module.exports.antibadwordCommand = antibadwordCommand;
module.exports.handleAntiBadwordCommand = handleAntiBadwordCommand;
module.exports.handleBadwordDetection = handleBadwordDetection;
