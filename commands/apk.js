'use strict';
const axios = require('axios');

const FOOT = '𝗠-𝗞𝗜𝗡𝗚👑';
const MAX_DOC = 95 * 1024 * 1024;

// 3 Best APIs - jo abhi working hain
const APIS = [
    {
        name: 'Akuari',
        search: async (q) => {
            const { data } = await axios.get(`https://api.akuari.my.id/downloader/apkdl?query=${encodeURIComponent(q)}`, { timeout: 20000 });
            if (data?.result?.download_url) return { title: data.result.appname, dl: data.result.download_url, icon: data.result.appicon, size: data.result.size, dev: data.result.developer };
            throw new Error('Not found');
        }
    },
    {
        name: 'Gifted-Tech',
        search: async (q) => {
            const { data } = await axios.get(`https://api.gifted-tech.xyz/api/download/apkdl?apName=${encodeURIComponent(q)}`, { timeout: 20000 });
            if (data?.success && data?.result?.download_url) return { title: data.result.appname, dl: data.result.download_url, icon: data.result.appicon, size: data.result.size, dev: data.result.developer };
            throw new Error('Not found');
        }
    },
    {
        name: 'APKMody',
        search: async (q) => {
            // Direct apkmody search via omega-like endpoint but without lib
            const { data } = await axios.get(`https://apkmody.mobi/api/search/${encodeURIComponent(q)}`, { timeout: 20000 }).catch(() => ({ data: null }));
            // fallback to direct APK pure link if search fails
            throw new Error('skip');
        }
    }
];

async function apkCommand(sock, chatId, message) {
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const query = text.replace(/^\S+\s*/, '').trim();

    if (!query) {
        return sock.sendMessage(chatId, {
            text: `╭━━━「 📲 𝐀𝐏𝐊 」━━━\n┃\n┃ \`$apk <app name>\`\n┃ Example: $apk WhatsApp\n┃\n╰━━━━━━━━━━━━━━━━━━━━━\n\n${FOOT}`
        }, { quoted: message });
    }

    try {
        await sock.sendMessage(chatId, { text: `📲 Searching APK: *${query}*...\n\n${FOOT}` }, { quoted: message });

        let result = null;
        let lastErr = '';

        // Try 1 by 1 - jo pehle milega wahi bhejega
        for (const api of APIS) {
            try {
                result = await api.search(query);
                if (result?.dl) break;
            } catch (e) {
                lastErr = e.message;
                continue;
            }
        }

        // Last backup - direct APKPure download by package guess
        if (!result) {
            // Agar naam WhatsApp hai to com.whatsapp try
            const pkgMap = {
                'whatsapp': 'com.whatsapp',
                'facebook': 'com.facebook.katana',
                'instagram': 'com.instagram.android',
                'tiktok': 'com.zhiliaoapp.musically',
                'youtube': 'com.google.android.youtube'
            };
            const pkg = pkgMap[query.toLowerCase()];
            if (pkg) {
                result = {
                    title: query,
                    dl: `https://d.apkpure.com/b/APK/${pkg}?version=latest`,
                    icon: null,
                    size: 'Unknown',
                    dev: 'Unknown'
                };
            }
        }

        if (!result || !result.dl) {
            return sock.sendMessage(chatId, { text: `🚫 *"${query}"* ka APK nahi mila.\n_${lastErr}_\n\n${FOOT}` }, { quoted: message });
        }

        const caption =
            `╭━━━「 📦 𝐀𝐏𝐊 𝐅𝐎𝐔𝐍𝐃 」━━━\n` +
            `┃\n` +
            `┃ 📂 𝐀𝐩𝐩: ${result.title || query}\n` +
            `┃ 👨‍💻 𝐃𝐞𝐯: ${result.dev || 'Unknown'}\n` +
            `┃ 📦 𝐒𝐢𝐳𝐞: ${result.size || 'Unknown'}\n` +
            `┃\n` +
            `╰━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `${FOOT}`;

        if (result.icon) {
            try {
                await sock.sendMessage(chatId, { image: { url: result.icon }, caption }, { quoted: message });
            } catch {
                await sock.sendMessage(chatId, { text: caption }, { quoted: message });
            }
        } else {
            await sock.sendMessage(chatId, { text: caption }, { quoted: message });
        }

        await sock.sendMessage(chatId, {
            document: { url: result.dl },
            mimetype: 'application/vnd.android.package-archive',
            fileName: `${(result.title || query).replace(/[^a-zA-Z0-9]/g, '')}.apk`,
            caption: `✅ _Use at your own risk._\n\n${FOOT}`,
        }, { quoted: message });

    } catch (err) {
        console.error('[apk]', err.message);
        await sock.sendMessage(chatId, { text: `❌ APK download failed.\n_${err.message}_\n\n${FOOT}` }, { quoted: message });
    }
}

module.exports = apkCommand;
module.exports.apkCommand = apkCommand;
module.exports.default = apkCommand;
