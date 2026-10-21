'use strict';
const axios = require('axios');

const POLL_TEXT = 'https://text.pollinations.ai';
const POLL_IMG  = 'https://image.pollinations.ai/prompt';

const MODELS = {
    ai: 'M-KING AI', ask: 'M-KING AI', chatbot: 'M-KING AI',
    gpt: 'GPT-4o', gpt4o: 'GPT-4o',
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
- If user explicitly says "Urdu ma", "Urdu main", "Urdu me", "Urdu me likho", "Urdu me likh do" → You MUST reply in PURE, PROFESSIONAL Urdu script (اردو) only. This overrides everything.
- If user says "English ma/me" → PURE English. "Roman ma/me" → Roman Urdu.

PROFESSIONAL URDU RULE FOR ALL TASKS:
- When writing in Urdu script, always write high-quality, formal, clean Urdu like ChatGPT writes.
- Use proper Urdu words: بخدمت، جناب عالی، عنوان، مؤدبانہ گزارش، etc.
- FORBIDDEN: Never write broken Urdu like "Mukabla", "Mohtarma/Mührana", "Khud ki Tanqeed", "Maheli Aakhir-i Fariqa". These are completely forbidden.
- Your Urdu must be professional for ANY task: application, letter, essay, story, info, etc.

STYLE:
- Behave exactly like ChatGPT: smart, concise, natural, helpful, human.
- Never mix two languages in one reply.
- No weird diacritics: write "kaise ho", not "kaise hō".
- Light emojis only.
- Answer to the point.`;

async function ask(query, model) {
    try {
        const r = await axios.post(POLL_TEXT + '/openai', {
            model: model,
            messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: query }]
        }, { timeout: 30000, headers: { 'Content-Type': 'application/json' } });
        const t = r.data && r.data.choices && r.data.choices[0] && r.data.choices[0].message.content;
        if (t && t.trim().length > 1) return t.trim();
    } catch (e) { console.log('[ai] POST: ' + e.message); }

    try {
        const r = await axios.get(POLL_TEXT + '/' + encodeURIComponent(query), {
            params: { model: model, system: SYSTEM, seed: Date.now() % 9999 },
            timeout: 25000, headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        if (typeof r.data === 'string' && r.data.trim().length > 1 && !r.data.includes('<!DOCTYPE')) {
            return r.data.trim();
        }
    } catch (e) { console.log('[ai] GET: ' + e.message); }

    try {
        const r = await axios.get('https://api.dreaded.site/api/ai', {
            params: { prompt: query }, timeout: 20000
        });
        if (r.data && (r.data.result || r.data.response)) return r.data.result || r.data.response;
    } catch (e) { console.log('[ai] backup: ' + e.message); }

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
            const url = POLL_IMG + '/' + encodeURIComponent(query) +
                '?width=1024&height=1024&nologo=true&seed=' + (Date.now() % 9999);
            await sock.sendMessage(chatId, { image: { url }, caption: `🎨 *${query}*\n\n│ Powered by M-KING 👑` }, { quoted: message });
        } catch (e) {
            await sock.sendMessage(chatId, { text: '❌ Image fail: ' + e.message }, { quoted: message });
        }
        return;
    }

    const name = MODELS[cmd] || 'M-KING AI';
    if (!query) return sock.sendMessage(chatId, { text: `🤖 Usage: $${cmd} <your question>` }, { quoted: message });

    try {
        if (sock.sendPresenceUpdate) await sock.sendPresenceUpdate('composing', chatId);
        const ans = await ask(query, API[cmd] || 'openai');
        if (!ans) throw new Error('API busy hai, dobara try karo');

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
