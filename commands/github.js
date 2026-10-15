const fs = require('fs');
const path = require('path');

async function githubCommand(sock, chatId, message) {
    try {
        let txt = `*Dara Studio Bot REPO* \n\n`;
        txt += `\`\`\`Repo : https://github.com/adtelecominfo-png/M-KING-Bot-V1\`\`\`\n\n`;
        txt += `\`\`\`Kindly fork and star the repo ⭐\`\`\`\n\n`;
        txt += `> DEV : M-KING SHOP ✪`;

        const possiblePaths = [
            path.join(__dirname, '../assets/repo_image.jpg'),
            path.join(process.cwd(), 'assets/repo_image.jpg'),
        ];
        let imgPath;
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) { imgPath = p; break; }
        }

        if (imgPath) {
            const imgBuffer = fs.readFileSync(imgPath);
            await sock.sendMessage(chatId, {
                image: imgBuffer,
                caption: txt,
                mimetype: 'image/jpeg',
            }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { text: txt }, { quoted: message });
        }
    } catch (error) {
        console.error('Error in github command:', error);
        await sock.sendMessage(chatId, {
            text: `*M-KING Bot V1 REPO*\n\n\`\`\`https://github.com/adtelecominfo-png/M-KING-Bot-V1\`\`\`\n\n> DEV : M-KING SHOP ✪`
        }, { quoted: message });
    }
}

module.exports = githubCommand;
