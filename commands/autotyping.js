/**
 * Knight Bot - M-KING FIXED
 * Autotyping Command - Shows fake typing status - WORKING 100%
 */

const fs = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../lib/isOwner');
const { isAuthorizedOwnerSession } = require('../lib/isOwner');

// Path to store the configuration
const configDir = path.join(__dirname, '..', 'data');
const configPath = path.join(configDir, 'autotyping.json');

// Initialize configuration file if it doesn't exist
function initConfig() {
    try {
        if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
        if (!fs.existsSync(configPath)) {
            fs.writeFileSync(configPath, JSON.stringify({ enabled: false }, null, 2));
        }
        return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch {
        return { enabled: false };
    }
}

// Toggle autotyping feature
async function autotypingCommand(sock, chatId, message) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        const isOwner = await isOwnerOrSudo(senderId, sock, chatId);
        
        if (!isAuthorizedOwnerSession(sock) || (!message.key.fromMe && !isOwner)) {
            await sock.sendMessage(chatId, { text: '❌ This command is only available for the owner!' });
            return;
        }

        // Get command arguments - FIXED
        let text = message.message?.conversation || message.message?.extendedTextMessage?.text || "";
        const args = text.trim().split(' ').slice(1);
        
        const config = initConfig();
        
        if (args.length > 0) {
            const action = args[0].toLowerCase();
            if (action === 'on' || action === 'enable') {
                config.enabled = true;
            } else if (action === 'off' || action === 'disable') {
                config.enabled = false;
            } else {
                await sock.sendMessage(chatId, { text: '❌ Invalid option! Use: $autotyping on/off' });
                return;
            }
        } else {
            config.enabled = !config.enabled;
        }
        
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        
        await sock.sendMessage(chatId, {
            text: `✅ Auto-typing has been *${config.enabled ? 'enabled' : 'disabled'}*! ${config.enabled ? '⌨️' : '💤'}`
        });
        
    } catch (error) {
        console.error('Error in autotyping command:', error);
        await sock.sendMessage(chatId, { text: '❌ Error processing command!' });
    }
}

function isAutotypingEnabled() {
    try {
        const config = initConfig();
        return config.enabled;
    } catch {
        return false;
    }
}

// MAIN FIX - Yehi function kaam karega - SIMPLE & WORKING
async function handleAutotypingForMessage(sock, chatId, userMessage = "hello") {
    if (!isAutotypingEnabled()) return false;
    try {
        // FIXED: Sirf composing bhejo, available/paused ka chakkar khatam
        await sock.presenceSubscribe(chatId).catch(()=>{});
        await sock.sendPresenceUpdate('composing', chatId);
        
        // Message length ke hisab se typing delay
        const delay = Math.min(7000, Math.max(3000, userMessage.length * 120));
        await new Promise(res => setTimeout(res, delay));
        
        // Dobara composing taake visible rahe
        await sock.sendPresenceUpdate('composing', chatId).catch(()=>{});
        await new Promise(res => setTimeout(res, 1000));
        
        return true;
    } catch (error) {
        console.error('❌ Error sending typing indicator:', error.message);
        return false;
    }
}

async function handleAutotypingForCommand(sock, chatId) {
    return handleAutotypingForMessage(sock, chatId, "command processing...");
}

async function showTypingAfterCommand(sock, chatId) {
    if (!isAutotypingEnabled()) return false;
    try {
        await sock.presenceSubscribe(chatId).catch(()=>{});
        await sock.sendPresenceUpdate('composing', chatId);
        await new Promise(res => setTimeout(res, 1500));
        return true;
    } catch {
        return false;
    }
}

module.exports = {
    autotypingCommand,
    isAutotypingEnabled,
    handleAutotypingForMessage,
    handleAutotypingForCommand,
    showTypingAfterCommand
};
