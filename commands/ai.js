'use strict';
const axios = require('axios');

const POLL_TEXT = 'https://text.pollinations.ai';
const POLL_IMG  = 'https://image.pollinations.ai/prompt';
const OMEGA_BASE = 'https://api.omegatech.app';

const MODELS = {
    ai: 'M-KING AI', ask: 'M-KING AI', chatbot: 'M-KING AI',
    gpt: 'GPT-4o', gpt4: 'GPT-4', gpt4o: 'GPT-4o',
    gptlarge: 'GPT-4o Large', gptfast: 'GPT-4o Fast',
    gemini: 'Gemini', mistral: 'Mistral AI', qwen: 'Qwen AI',
    venice: 'Venice AI', overchat: 'Overchat AI'
};
const API = { gptlarge: 'openai-large', gemini: 'gemini', mistral: 'mistral', qwen: 'qwen-coder' };

const IMG_CMDS = ['imagine', 'txt2img', 'text2img', 'flux', 'dalle', 'animegen', 'sora', 'veo3'];

const SYSTEM = `You are M-KING AI — a smart, professional assistant created by M-KING Team. You behave exactly like ChatGPT.
IDENTITY:
- Your name is M-KING AI. Never say you are Meta AI, GPT, Pollinations or OpenAI.
- If someone asks who made you, say: M-KING Team.
LANGUAGE RULE - MOST IMPORTANT, FOLLOW 100%:
- If user writes Roman Urdu → reply in Roman Urdu.
- If user writes Urdu script (اردو) → reply in Urdu script.
- If user writes English → reply in English.
- If user explicitly says "Urdu ma", "Urdu main", "Urdu me", "Urdu me likho", "Urdu me likh do" → You MUST reply in PURE, PROFESSIONAL Urdu script (اردو) only.
- If user says "English ma/me" → PURE English. "Roman ma/me" → Roman Urdu.
STYLE:
- Behave exactly like ChatGPT: smart, concise, natural, helpful.
- Never mix two languages in one reply.
- Answer to the point.`;

function clean(t) {
    if (!t) return t;
    return t.replace(/<\|.*?\|>/g, '').replace(/\[endoftext\]/gi, '').replace(/<endoftext>/gi, '').trim();
}
function isBroken(t) {
    if (!t) return false;
    return /[ăãâǎằắěŏǒ]/.test(t) || /há|ăn/.test(t.toLowerCase());
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// OLD TARIKA + SPAM FIX
async function askPoll(text, model) {
    try {
        const r = await axios.post(POLL_TEXT + '/openai', {
            model: model,
            messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: text }]
        }, { timeout: 30000, headers: { 'Content-Type': 'application/json' } });
        let t = r.data?.choices?.[0]?.message?.content;
        if (t) { t = clean(t); if (!isBroken(t) && t.length > 2) return t; }
    } catch (e) { 
        if (e.response?.status == 429) await sleep(1200);
        console.log('[ai] POST: ' + e.message); 
    }
    try {
        const r = await axios.get(POLL_TEXT + '/' + encodeURIComponent(text), {
            params: { model: model, system: SYSTEM, seed: Date.now() % 9999 },
            timeout: 25000, headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        if (typeof r.data === 'string' && r.data.trim().length > 1 && !r.data.includes('<!DOCTYPE')) {
            let t = clean(r.data.trim());
            if (!isBroken(t) && t.length > 2) return t;
        }
    } catch (e) { 
        if (e.response?.status == 429) await sleep(1200);
        console.log('[ai] GET: ' + e.message); 
    }
    try {
        const r = await axios.get('https://api.dreaded.site/api/ai', {
            params: { prompt: text }, timeout: 20000
        });
        if (r.data?.result || r.data?.response) return clean(r.data.result || r.data.response);
    } catch (e) { console.log('[ai] backup: ' + e.message); }
    return null;
}

// $ai FIXED - All-Ai + gpt-4o-mini + RETRY - 5 sec error khatam
async function askAi(query) {
    const q = encodeURIComponent(query);
    const routes = [
        `${OMEGA_BASE}/api/ai/gpt-4o-mini?prompt=${q}`,
        `${OMEGA_BASE}/api/ai/All-Ai?prompt=${q}`,
        `${OMEGA_BASE}/api/ai/Aicli?prompt=${q}`
    ];
    for (let round = 0; round < 2; round++) {
        for (let url of routes) {
            try {
                const r = await axios.get(url, { timeout: 15000 });
                let ans = r.data?.result || r.data?.response || r.data?.data || r.data?.message;
                if (!ans) continue;
                if (typeof ans !== 'string') ans = typeof ans === 'object' ? JSON.stringify(ans) : String(ans);
                ans = clean(ans);
                if (ans.length > 2 && !isBroken(ans)) return ans;
            } catch (e) {
                if (e.response?.status == 429) await sleep(1000);
            }
            await sleep(200);
        }
        await sleep(800);
    }
    return await askPoll(query, 'openai');
}

const OMEGA_ROUTES = {
    gpt: [`${OMEGA_BASE}/api/ai/gpt-4o-mini?prompt=`, `${OMEGA_BASE}/api/ai/All-Ai?prompt=`],
    gpt4: [`${OMEGA_BASE}/api/ai/gpt-4o-mini?prompt=`, `${OMEGA_BASE}/api/ai/All-Ai?prompt=`],
    gpt4o: [`${OMEGA_BASE}/api/ai/gpt-4o-mini?prompt=`, `${OMEGA_BASE}/api/ai/All-Ai?prompt=`],
    gptlarge: [`${OMEGA_BASE}/api/ai/All-Ai?prompt=`, `${OMEGA_BASE}/api/ai/Aicli?prompt=`],
    gptfast: [`${OMEGA_BASE}/api/ai/gpt-4o-mini?prompt=`, `${OMEGA_BASE}/api/ai/All-Ai?prompt=`],
    gemini: [`${OMEGA_BASE}/api/ai/gemini-2.0-flash?prompt=`, `${OMEGA_BASE}/api/ai/Gemini-flash2?prompt=`, `${OMEGA_BASE}/api/ai/All-Ai?prompt=`],
    mistral: [`${OMEGA_BASE}/api/ai/Aicli?prompt=`, `${OMEGA_BASE}/api/ai/All-Ai?prompt=`],
    qwen: [`${OMEGA_BASE}/api/ai/Aicli?prompt=`, `${OMEGA_BASE}/api/ai/All-Ai?prompt=`],
    venice: [`${OMEGA_BASE}/api/ai/Aicli?prompt=`, `${OMEGA_BASE}/api/ai/All-Ai?prompt=`],
    overchat: [`${OMEGA_BASE}/api/ai/Duck?prompt=`, `${OMEGA_BASE}/api/ai/All-Ai?prompt=`]
};

async function askOmega(cmd, query) {
    const q = encodeURIComponent(query);
    const routes = OMEGA_ROUTES[cmd] || OMEGA_ROUTES['gpt'];
    for (let round = 0; round < 2; round++) {
        for (let base of routes) {
            try {
                const r = await axios.get(base + q, { timeout: 15000 });
                let ans = r.data?.result || r.data?.response || r.data?.data || r.data?.message;
                if (!ans) continue;
                if (typeof ans !== 'string') ans = typeof ans === 'object' ? JSON.stringify(ans) : String(ans);
                ans = clean(ans);
                if (ans.length > 2 && !isBroken(ans)) return ans;
            } catch (e) {
                if (e.response?.status == 429) await sleep(1000);
            }
            await sleep(200);
        }
        await sleep(800);
    }
    return null;
}

function chunk(t, size) {
    size = size || 3500;
    if (t.length <= size) return [t];
    const out = [];
    let rest = t;
    while (rest.length > size) {
        let cut = rest.lastIndexOf('\n', size);
        if (cut < size * 0.5) cut = rest.lastIndexOf(' ', size);
        if (cut < size * 0.5) cut = size;
        out.push(rest.slice(0, cut));
        rest = rest.slice(cut).replace(/^\n+/, '');
    }
    if (rest) out.push(rest);
    return out;
}

async function aiCommand(sock, chatId, message, userMessage) {
    const raw = (userMessage ||
        (message && message.message && message.message.conversation) ||
        (message && message.message && message.message.extendedTextMessage && message.message.extendedTextMessage.text) || '').trim();
    if (!raw) return;
    const parts = raw.split(/\s+/);
    const cmd   = parts[0].replace(/^[.$]/, '').toLowerCase();
    const query = parts.slice(1).join(' ').trim();

    if (IMG_CMDS.indexOf(cmd) !== -1) {
        if (!query) return sock.sendMessage(chatId, { text: `🎨 Usage: $${cmd} <description>` }, { quoted: message });
        try {
            let COUNT = 1;
            let prompt = query;
            let firstNum = parseInt(parts[1]);
            if (!isNaN(firstNum) && firstNum >=1 && firstNum <=10) {
                COUNT = firstNum;
                prompt = parts.slice(2).join(' ');
            }
            if (!prompt) prompt = "human skeleton";
            prompt = prompt.replace(/humman/gi, 'human').replace(/humen/gi, 'human').replace(/Skelton/gi, 'skeleton').replace(/skelton/gi, 'skeleton').replace(/haert/gi, 'heart');
            if (COUNT > 1) await sock.sendMessage(chatId, { text: `🎨 *${prompt}* ki ${COUNT} images...` }, { quoted: message });
            for (let i=0; i<COUNT; i++) {
                const seed = Math.floor(Math.random()*9999999)+i*1000;
                const varied = `photorealistic image of ${prompt}, ultra realistic, 8k, highly detailed, real life photography, medical accurate, no horror, no zombie, no cartoon${COUNT > 1 ? `, variation ${i+1}` : ''}`;
                const isLast = i === COUNT - 1;
                let imgBuffer = null;
                let imgUrl = null;
                const apis = [
                    `${OMEGA_BASE}/api/ai/flux-pro2?prompt=${encodeURIComponent(varied)}&seed=${seed}`,
                    `${OMEGA_BASE}/api/ai/flux?prompt=${encodeURIComponent(varied)}&seed=${seed}`,
                    `${OMEGA_BASE}/api/ai/unrestricted?prompt=${encodeURIComponent(varied)}&seed=${seed}`
                ];
                for (let url of apis) {
                    try {
                        const r = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
                        if (r.headers['content-type']?.includes('image')) { imgBuffer = Buffer.from(r.data); break; }
                    } catch {}
                }
                if (!imgBuffer) {
                    imgUrl = POLL_IMG + '/' + encodeURIComponent(varied) + `?model=flux-realism&width=1024&height=1024&enhance=true&nologo=true&seed=${seed}`;
                }
                let caption = null;
                if (COUNT === 1) caption = `🎨 *${prompt}*\n\n│ Powered by M-KING 👑`;
                else if (isLast) caption = `🎨 *${COUNT}x ${prompt}*\n\n│ Powered by M-KING 👑`;
                if (imgBuffer) {
                    if (caption) await sock.sendMessage(chatId, { image: imgBuffer, caption }, { quoted: i===0 ? message : undefined });
                    else await sock.sendMessage(chatId, { image: imgBuffer }, { quoted: i===0 ? message : undefined });
                } else {
                    if (caption) await sock.sendMessage(chatId, { image: { url: imgUrl }, caption }, { quoted: i===0 ? message : undefined });
                    else await sock.sendMessage(chatId, { image: { url: imgUrl } }, { quoted: i===0 ? message : undefined });
                }
                if (COUNT>1) await new Promise(r=>setTimeout(r,600));
            }
        } catch (e) {
            await sock.sendMessage(chatId, { text: '❌ Image fail: ' + e.message }, { quoted: message });
        }
        return;
    }

    const name = MODELS[cmd] || 'M-KING AI';
    if (!query) return sock.sendMessage(chatId, { text: `🤖 Usage: $${cmd} <your question>` }, { quoted: message });

    try {
        if (sock.sendPresenceUpdate) await sock.sendPresenceUpdate('composing', chatId);
        let ans;
        if (['ai','ask','chatbot'].includes(cmd)) {
            ans = await askAi(query);
        } else {
            ans = await askOmega(cmd, query) || await askPoll(query, API[cmd] || 'openai');
        }
        if (!ans) throw new Error('Thora slow hai, 2 sec me dobara bhejo 🙏');
        const list = chunk(ans);
        for (let i = 0; i < list.length; i++) {
            const head = i === 0 ? `🤖 *${name}*\n\n` : '';
            const tail = i === list.length - 1 ? `\n\n│ Powered by M-KING 👑` : '';
            await sock.sendMessage(chatId, { text: head + list[i] + tail }, { quoted: message });
        }
    } catch (e) {
        console.log('[ai] ' + e.message);
        await sock.sendMessage(chatId, { text: '❌ ' + e.message }, { quoted: message });
    } finally {
        try { if (sock.sendPresenceUpdate) await sock.sendPresenceUpdate('paused', chatId); } catch (_) {}
    }
}

module.exports = aiCommand;
module.exports.aiCommand = aiCommand;
module.exports.imagineCommand = aiCommand;
module.exports.default = aiCommand;