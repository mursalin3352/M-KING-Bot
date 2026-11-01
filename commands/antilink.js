const { setAntilink, getAntilink, removeAntilink } = require('../lib/index');
const isAdmin = require('../lib/isAdmin');

async function handleAntilinkCommand(sock, chatId, userMessage, senderId, isSenderAdmin, message) {
    try {
        if (!isSenderAdmin) {
            await sock.sendMessage(chatId, { text: '╔═══『 ⛔ *ADMIN ONLY* 🔒 』═══╗\n║ 👮 ```For Group Admins Only!```\n╚══════════════════════════╝' }, { quoted: message });
            return;
        }

        const prefix = '.';
        const args = userMessage.slice(prefix.length).trim().split(' ');
        
        // Remove "antilink" from args
        args.shift();
        
        const action = args[0]?.toLowerCase();

        if (!action) {
            const usage = 
`╔══════════════════════════╗
║   🔗  ᴀɴᴛɪ-ʟɪɴᴋ ᴄᴇɴᴛʀᴇ  🔗   ║
╚══════════════════════════╝

┏━━━━━━━━━━━━━━━━━━━━━━┓
┃ ⚙️  𝘼𝙉𝙏𝙄𝙇𝙄𝙉𝙆 𝙎𝙀𝙏𝙐𝙋
┣━━━━━━━━━━━━━━━━━━━━━━┫
┃ 🔰 ${prefix}antilink on
┃ ⚔️  ${prefix}antilink set delete | kick | warn
┃ 🔰 ${prefix}antilink off
┃ 📊 ${prefix}antilink get
┗━━━━━━━━━━━━━━━━━━━━━━┛
╰─► 👑 𝙈-𝙆𝙄𝙉𝙂👑 ◄─╯`;
            await sock.sendMessage(chatId, { text: usage }, { quoted: message });
            return;
        }

        switch (action) {
            case 'on':
                const existingConfig = await getAntilink(chatId, 'on');
                if (existingConfig?.enabled) {
                    await sock.sendMessage(chatId, { text: '✅ 🟢 *_Antilink is already on_* 🔗' }, { quoted: message });
                    return;
                }
                const result = await setAntilink(chatId, 'on', 'delete');
                await sock.sendMessage(chatId, { 
                    text: result ? '╔═══『 🛡️ *ANTILINK ON* 🟢 』═══╗\n║ 🔗 *_Antilink has been turned ON_* ✅\n╚════『 👑 M-KING 』════╝' : '❌ 🔴 *_Failed to turn on Antilink_* ⚠️' 
                },{ quoted: message });
                break;

            case 'off':
                await removeAntilink(chatId, 'on');
                await sock.sendMessage(chatId, { text: '╔═══『 🚫 *ANTILINK OFF* 🔴 』═══╗\n║ 💤 *_Antilink has been turned OFF_* 🔴\n╚════『 👑 M-KING 』════╝' }, { quoted: message });
                break;

            case 'set':
                if (args.length < 2) {
                    await sock.sendMessage(chatId, { 
                        text: `⚙️ ❓ *_Please specify an action: ${prefix}antilink set delete 🗑️ | kick 🦶 | warn ⚠️_*` 
                    }, { quoted: message });
                    return;
                }
                const setAction = args[1].toLowerCase();
                if (!['delete', 'kick', 'warn'].includes(setAction)) {
                    await sock.sendMessage(chatId, { 
                        text: '❌ ⚠️ *_Invalid action. Choose delete 🗑️, kick 🦶, or warn ⚠️_*' 
                    }, { quoted: message });
                    return;
                }
                const setResult = await setAntilink(chatId, 'on', setAction);
                await sock.sendMessage(chatId, { 
                    text: setResult ? `✅ ⚙️ *_Antilink action set to ${setAction.toUpperCase()}_* ${setAction=='delete'?'🗑️':setAction=='kick'?'🦶':'⚠️'}` : '*_Failed to set Antilink action_*' 
                }, { quoted: message });
                break;

            case 'get':
                const config = await getAntilink(chatId, 'on');
                if (!config) {
                    await sock.sendMessage(chatId, { 
                        text: '╔═══『 📊 *CONFIG* 🔗 』═══╗\n║ 🔴 *_Antilink is OFF_* 💤\n╚═══════════════════════╝' 
                    }, { quoted: message });
                } else {
                    await sock.sendMessage(chatId, { 
                        text: `╔═══『 📊 *ANTILINK CONFIG* 🔗 』═══╗\n║ 🟢 Status: *${config.enabled ? 'ON ✅' : 'OFF 🔴'}*\n║ ⚔️ Action: *${(config.action || 'Not set').toUpperCase()}* ${config.action=='delete'?'🗑️':config.action=='kick'?'🦶':'⚠️'}\n╚════『 👑 M-KING 』════╝` 
                    }, { quoted: message });
                }
                break;

            default:
                await sock.sendMessage(chatId, { text: `❓ 🔗 *_Use ${prefix}antilink for usage._* 📜` });
        }
    } catch (error) {
        console.error('Error in antilink command:', error);
        await sock.sendMessage(chatId, { text: '❌ ⚠️ *_Error processing antilink command_* 🔴' });
    }
}

module.exports = {
    handleAntilinkCommand
};
