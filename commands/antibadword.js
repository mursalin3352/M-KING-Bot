const { handleAntiBadwordCommand } = require('../lib/antibadword');

async function antibadwordCommand(sock, chatId, message, senderId, isSenderAdmin) {
    try {
        // Auto Owner Detect - Bot ka apna number hi owner hai
        const isOwner = message.key.fromMe;
        
        // Sirf Admin ya Owner allow
        if (!isSenderAdmin && !isOwner) {
            await sock.sendMessage(chatId, { text: '```For Group Admins or Bot Owner Only!```' }, { quoted: message });
            return;
        }

        const text = message.message?.conversation || 
                    message.message?.extendedTextMessage?.text || '';
        
        const match = text.split(' ').slice(1).join(' ').trim().toLowerCase();

        await handleAntiBadwordCommand(sock, chatId, message, match);

    } catch (e) {
        console.error('Error in antibadword command:', e);
        await sock.sendMessage(chatId, { text: '*Error processing command*' }, { quoted: message });
    }
}

module.exports = antibadwordCommand;
