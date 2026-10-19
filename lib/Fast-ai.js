const axios = require('axios');
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 300 }); // 5 min cache = super fast

// WORKING FAST APIS - 2026 Tested
const APIS = {
    gpt: [
        "https://api.nexoracle.com/ai/chatgpt?prompt=",
        "https://api.siputzx.my.id/api/ai/gpt3?content=",
        "https://api.dreaded.site/api/ai/gpt?text="
    ],
    gemini: "https://api.nexoracle.com/ai/gemini?prompt=",
    image: "https://api.nexoracle.com/ai/text2img?prompt="
};

async function fastRequest(urls, query) {
    const encoded = encodeURIComponent(query);
    
    // Cache check - Agar pehle pucha hai to instant reply!
    const cacheKey = query.toLowerCase();
    if (cache.has(cacheKey)) {
        return cache.get(cacheKey) + "\n\n_(cached ⚡)_";
    }

    const list = Array.isArray(urls) ? urls : [urls];
    
    for (let baseUrl of list) {
        try {
            const res = await axios.get(baseUrl + encoded, {
                timeout: 15000, // 15s only = fast
                headers: { 'User-Agent': 'M-KING-BOT' }
            });
            let ans = res.data?.result || res.data?.data || res.data?.answer;
            if (ans) {
                cache.set(cacheKey, ans);
                return ans;
            }
        } catch (e) { continue; }
    }
    throw new Error("Server busy, try again 1 sec");
}

module.exports = { fastRequest, APIS };
