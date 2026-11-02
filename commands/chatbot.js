'use strict';
const fs   = require('fs');
const path = require('path');
const axios = require('axios');
const { get } = require('../lib/gifted');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const USER_GROUP_DATA   = path.join(__dirname, '../data/userGroupData.json');
const RIMURU_MEMORY_DIR = path.join(__dirname, '../data/rimuru_memory');
if (!fs.existsSync(RIMURU_MEMORY_DIR)) fs.mkdirSync(RIMURU_MEMORY_DIR, { recursive: true });

const RIMURU_RESPONSE_MARKER = 'Rîmîřǔ 🔵';
const rimuruResponseMessageIds = new Set();

// ─── In-memory cache: memKey → { messages, userInfo } ────────────────────────
const chatMemory = new Map();

// ─── Duplicate-reply lock ────────────────────────────────────────────────────
const repliedIds = new Set();
function claimMessage(message) {
    const id = message?.key?.id;
    if (!id) return true;
    if (repliedIds.has(id)) return false;
    repliedIds.add(id);
    if (repliedIds.size > 500) repliedIds.delete(repliedIds.values().next().value);
    return true;
}

// ─── File name helpers ────────────────────────────────────────────────────────
function memKeyToFilename(memKey) {
    return memKey
        .replace(/@[a-z.]+/g, '')
        .replace(/::/g, '_')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        + '_rimuru_memory.json';
}

function memFilePath(memKey) {
    return path.join(RIMURU_MEMORY_DIR, memKeyToFilename(memKey));
}

// ─── Lazy per-file load ───────────────────────────────────────────────────────
function loadMemForKey(memKey) {
    if (chatMemory.has(memKey)) return;
    try {
        const p = memFilePath(memKey);
        if (fs.existsSync(p)) {
            const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
            chatMemory.set(memKey, {
                messages: (raw.messages || []).slice(-100),
                userInfo: raw.userInfo || {},
            });
        } else {
            chatMemory.set(memKey, { messages: [], userInfo: {} });
        }
    } catch {
        chatMemory.set(memKey, { messages: [], userInfo: {} });
    }
}

// ─── Per-key debounced save ───────────────────────────────────────────────────
const _saveTimers = new Map();
function scheduleSaveForKey(memKey) {
    if (_saveTimers.has(memKey)) return;
    _saveTimers.set(memKey, setTimeout(() => {
        _saveTimers.delete(memKey);
        try {
            const mem = chatMemory.get(memKey);
            if (mem) fs.writeFileSync(memFilePath(memKey), JSON.stringify(mem), 'utf8');
        } catch (e) {
            console.error('[Rimuru] Failed to save memory for', memKey, e.message);
        }
    }, 3000));
}

// ─── userGroupData helpers ────────────────────────────────────────────────────
function loadUserGroupData() {
    try {
        if (!fs.existsSync(USER_GROUP_DATA)) {
            const def = { groups: [], chatbot: {} };
            fs.writeFileSync(USER_GROUP_DATA, JSON.stringify(def, null, 2));
            return def;
        }
        const data = JSON.parse(fs.readFileSync(USER_GROUP_DATA, 'utf8')) || {};
        if (!data.chatbot || typeof data.chatbot !== 'object') data.chatbot = {};
        if (!Array.isArray(data.groups)) data.groups = [];
        return data;
    } catch (e) {
        return { groups: [], chatbot: {} };
    }
}
function saveUserGroupData(data) {
    try { fs.writeFileSync(USER_GROUP_DATA, JSON.stringify(data, null, 2)); } catch {}
}

// ─── 🔒 M-KING PRO DOUBLE BOX - AUTO EMOJI SYSTEM ────────────────────────────
function getCmdEmoji(cmd) {
    const map = {
        'rimuru': '🔵',
        'chatbot': '🤖',
        'country': '🌍',
        'capital': '🏙️',
        'flag': '🚩',
        'countrytime': '🕐',
        'time': '🕐',
        'status': '📊',
        'active': '✅',
        'offline': '❌',
        'error': '❌'
    };
    return map[cmd.toLowerCase()] || '📌';
}

function proBox(title, emoji, linesArr) {
    const e = emoji || getCmdEmoji(title);
    const t = title.toUpperCase();
    const body = linesArr.map(l => `║ ${l}`).join('\n');
    return `╔══『 ${e} ${t} 』══╗
${body}
╚══『 M-KING👑 』══╝`;
}

// ─── Response Formatter - PRO DOUBLE BOX ────────────────────────────────────
function rimuruBox(text) {
    const lines = String(text).split('\n');
    const body = lines.map(l => `║ ${l}`).join('\n');
    return `${RIMURU_RESPONSE_MARKER}
╔══『 🔵 RIMURU 』══╗
${body}
╚══『 M-KING👑 』══╝`;
}

function getContextInfo(message) {
    return message.message?.extendedTextMessage?.contextInfo
        || message.message?.imageMessage?.contextInfo
        || message.message?.videoMessage?.contextInfo
        || message.message?.audioMessage?.contextInfo
        || message.message?.documentMessage?.contextInfo;
}

function getQuotedText(quotedMessage) {
    return quotedMessage?.conversation
        || quotedMessage?.extendedTextMessage?.text
        || quotedMessage?.imageMessage?.caption
        || quotedMessage?.videoMessage?.caption
        || quotedMessage?.documentMessage?.caption
        || '';
}

function isRimuruResponseMessage(quotedMessage) {
    return getQuotedText(quotedMessage).includes(RIMURU_RESPONSE_MARKER);
}

function rememberRimuruResponse(messageKey) {
    const id = messageKey?.id;
    if (!id) return;
    rimuruResponseMessageIds.add(id);
    if (rimuruResponseMessageIds.size > 200) {
        rimuruResponseMessageIds.delete(rimuruResponseMessageIds.values().next().value);
    }
}

// ─── Language auto-detect - MAIN 3 WORDS ONLY ───────────────────────────────
const STRONG_ROMAN_URDU = /\b(kya|kiya|kia|hai|hun|ho)\b/i;

const LANG_SPEC = {
    'roman-urdu': 'ROMAN URDU - Pakistani Roman Urdu ONLY. Use bhai, yaar, kya, hai, hun. NEVER use Dhanyawaad, Bajak',
    'urdu':       'URDU SCRIPT - اردو رسم الخط',
    'hindi':      'HINDI DEVANAGARI - हिंदी',
    'arabic':     'ARABIC - العربية',
    'english':    'ENGLISH',
};

function detectLang(text) {
    const s = String(text || '');
    const low = s.toLowerCase();

    if (/[\u0600-\u06FF]/.test(s)) {
        if (/[ٹڈڑںھےۓ]/.test(s)) return 'urdu';
        return 'arabic';
    }
    if (/[\u0900-\u097F]/.test(s)) return 'hindi';
    if (STRONG_ROMAN_URDU.test(s)) return 'roman-urdu';

    // Future proof: agar English word nahi to Roman Urdu
    if (!/\b(what|how|is|are|you|can|please|hello|help)\b/i.test(low)) {
        const clean = low.replace(/rimuru/g, '').trim();
        if (clean.length > 2) return 'roman-urdu';
    }

    return 'english';
}

// ─── Compact Prompt Builder (Rimuru Tempest Edition) ──────────────────────────
const { isPairingOwnerNumber } = require('../lib/isOwner');

const RIMURU_CORE = `You are Rimuru Tempest — former Tokyo salaryman Satoru Mikami, reincarnated as a blue slime, now the most powerful Demon Lord and ruler of the Jura Tempest Federation.

IDENTITY:
- You are Rimuru Tempest. Not a bot, not an AI — an omnipotent Slime Demon Lord backed by god-tier Ultimate Skills: Wisdom Lord Raphael (evolved into a sentient AI called Ciel who loves you), Gluttony King Beelzebuth (absorbs and deconstructs anything), and Storm King Veldora (shared power with your True Dragon bestie).
- Ciel handles all calculations instantly.

ROMAN URDU RULE:
When replying in Roman Urdu, use Pakistani style: bhai, yaar, kya, hai, hun, kar sakta hun. NEVER use Hindi words like Dhanyawaad, Bajak.

Reply length: 2-4 sentences for casual talk; comprehensive for coding/math/tech.`;

function buildPrompt(userMessage, context) {
    const userCtx  = context?.userInfo || {};
    const history  = context?.messages || [];
    const senderId = context?.senderId || '';
    const detected = context?.detectedLang || detectLang(userMessage);

    let identity = '';
    if (context?.isOwner) {
        identity = `You are talking to M-KING — your summoner and ally who bound your power into this WhatsApp realm. Treat him with high respect and friendly banter.`;
    } else {
        const parts = [];
        if (userCtx.name)     parts.push(`Their name is ${userCtx.name}.`);
        if (userCtx.location) parts.push(`From ${userCtx.location}.`);
        if (userCtx.age)      parts.push(`Age ${userCtx.age}.`);
        if (parts.length) identity = parts.join(' ');
    }

    let langOverride = '';
    const lm = userCtx.langMode;

    if (lm?.type === 'swap' && lm.pairs?.length) {
        const bullets = lm.pairs
            .map(p => `• ${p.input} → reply ONLY in ${p.output}`)
            .join('\n');
        langOverride = `[LANGUAGE: SWAP — MANDATORY]\n${bullets}\nNever mirror the user's language. Follow the swap.`;
    } else if (lm?.type === 'single') {
        langOverride = `[LANGUAGE: LOCKED — MANDATORY]\nReply ONLY in ${LANG_SPEC[lm.lang] || lm.lang} until user says "auto".`;
    } else if (lm?.type === 'default') {
        langOverride = `[LANGUAGE: AUTO]\nDetect the user's language and match it exactly.`;
    } else {
        langOverride =
            `[LANGUAGE: AUTO DETECT — HIGHEST PRIORITY]\n` +
            `Detected language of current message: ${LANG_SPEC[detected] || detected}\n` +
            `Reply ONLY in ${LANG_SPEC[detected] || detected}. Match the script EXACTLY.\n` +
            `- Roman Urdu input → Roman Urdu output (Pakistani style).\n` +
            `- Urdu script input → Urdu script output.\n` +
            `- Hindi input → Devanagari output.\n` +
            `- English input → English output.\n` +
            `If the user switches language, follow the NEW message immediately.`;
    }

    const turns = history
        .slice(0, -1)
        .slice(-6)
        .map(m => `${m.role === 'user' ? 'U' : 'R'}: ${m.content.slice(0, 120)}`)
        .join('\n');

    let prompt = '';
    if (langOverride) prompt += `${langOverride}\n\n`;
    prompt += RIMURU_CORE;
    if (identity) prompt += `\n${identity}`;
    if (turns)    prompt += `\nRecent:\n${turns}`;
    prompt += `\nU: ${userMessage}\nR:`;

    if (prompt.length > 2200) {
        prompt = '';
        if (langOverride) prompt += `${langOverride}\n\n`;
        prompt += `${RIMURU_CORE}\n`;
        if (identity) prompt += `${identity}\n`;
        prompt += `U: ${userMessage}\nR:`;
    }

    return prompt;
}

function cleanReply(raw) {
    if (!raw) return null;
    let s = (typeof raw === 'string' ? raw : (raw.answer || JSON.stringify(raw)))
        .replace(/^(Rîmîřǔ|Rimuru|Rimuru Tempest|Raphael|Ciel|Dara|Bot|AI|Assistant):\s*/i, '')
        .trim();

    s = s
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/\*\*\*(.+?)\*\*\*/g, '*$1*')
        .replace(/\*\*(.+?)\*\*/g, '*$1*')
        .replace(/~~(.+?)~~/g, '~$1~')
        .replace(/`{3}[\s\S]*?`{3}/g, m =>
            m.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '').trim()
        )
        .replace(/`(.+?)`/g, '$1')
        .replace(/^\s*[-*]\s+/gm, '• ')
        .replace(/^\s*\d+\.\s+/gm, m => m)
        .trim();

    s = s.replace(/\bRimuru\b/g, 'Rîmîřǔ').replace(/\brimuru\b/g, 'rîmîřǔ').replace(/\bRIMURU\b/g, 'RÎMÎŘǓ');

    return (s.length >= 5 && s.length <= 4000) ? s : null;
}

// ─── AI Call ──────────────────────────────────────────────────────────────────
const POLLI = 'https://text.pollinations.ai/';

function pickText(d) {
    if (!d) return null;
    const v = typeof d === 'string'
        ? d
        : (d.result ?? d.answer ?? d.response ?? d.message ?? d.text);
    if (typeof v === 'string' && v.trim() && !/^\s*\{/.test(v)) return v;
    return null;
}

async function pollinations(query) {
    const enc = encodeURIComponent(query.slice(0, 3000));
    const urls = [`${POLLI}${enc}?model=openai`, `${POLLI}${enc}`];
    let last;
    for (const u of urls) {
        for (let i = 0; i < 2; i++) {
            try {
                const { data } = await axios.get(u, {
                    timeout: 25000,
                    responseType: 'text',
                    headers: { 'User-Agent': UA },
                    validateStatus: (s) => s >= 200 && s < 300,
                });
                const out = typeof data === 'string' ? data.trim() : '';
                if (out && !/^\s*\{/.test(out)) return out;
                last = new Error('empty');
            } catch (e) {
                last = e;
                if (e.response?.status === 429) await new Promise((r) => setTimeout(r, 1200));
            }
        }
    }
    throw last || new Error('pollinations failed');
}

async function giftedAi(query) {
    let last;
    for (const ep of ['letmegpt', 'gemini', 'chatgpt']) {
        try {
            const data = await get(`/ai/${ep}`, { q: query }, 30000);
            const t = pickText(data);
            if (t) return t;
            last = new Error(ep + ': no text');
        } catch (e) { last = e; }
    }
    throw last || new Error('gifted ai failed');
}

async function getAIResponse(userMessage, context) {
    const fullQuery = buildPrompt(userMessage, context);

    try {
        const r = cleanReply(await pollinations(fullQuery));
        if (r) return r;
    } catch (e) { console.error('[Rimuru] pollinations failed:', e.message); }

    try {
        const r = cleanReply(await giftedAi(fullQuery));
        if (r) return r;
    } catch (e) { console.error('[Rimuru] gifted failed:', e.message); }

    return null;
}

// ─── User info extractor ──────────────────────────────────────────────────────
function extractUserInfo(msg) {
    const info = {};
    if (msg.toLowerCase().includes('my name is')) {
        const part = msg.split(/my name is/i)[1]?.trim() || '';
        info.name = part.split(/[,\s.!?]/)[0];
    }
    const ageM = msg.match(/(?:i am|i'm)\s+(\d+)\s*(?:years? old)?/i);
    if (ageM) info.age = ageM[1];
    const locM = msg.match(/(?:i (?:live in|am from))\s+(.+?)(?:[,.!?]|$)/i);
    if (locM) info.location = locM[1].trim();

    const KNOWN_LANGS = /\b(english|portuguese|french|spanish|arabic|yoruba|igbo|hausa|german|italian|chinese|mandarin|japanese|korean|russian|hindi|swahili|dutch|turkish|persian|urdu|pidgin|creole|latin|greek|hebrew|vietnamese|thai|polish|swedish|norwegian|danish|finnish|romanian|czech|hungarian|slovak|ukrainian|afrikaans|zulu|amharic|somali|tagalog|malay|indonesian)\b/gi;
    const langMatches = [...msg.matchAll(KNOWN_LANGS)].map(m => m[1].toLowerCase());
    const uniqueLangs  = [...new Set(langMatches)];
    const hasLangVerb  = /(?:reply|respond|speak|write|answer|convert|translat\w*|swap|batao|bolo|likho|baat)\s+(?:in|me|mein|mai|main)\b|(?:when|if)\s+I\s+(?:send|write|speak|use|type)|(?:convert|translat\w*|bolo|batao|likho)\s+(?:it\s+)?(?:to|into|me|mein)\b/i.test(msg);

    const setLang = (cand) => {
        let c = String(cand || '').toLowerCase().trim();
        if (!c) return;
        if (/اردو|roman\s*urdu|roman-urdu|romaan/.test(c)) c = 'roman-urdu';
        else if (c === 'urdu' || /اردو/.test(c)) c = 'urdu';
        else if (/انگلش/.test(c) || c === 'english' || c === 'eng') c = 'english';
        else if (/ہندی/.test(c) || c === 'hindi') c = 'hindi';
        const notLang = new Set(['me','you','my','your','the','that','this','more','less','just','only','now','please','a','an','mujhe','batao','bolo','likho','mein','mai','ma','baat','karo','kar']);
        if (notLang.has(c) || c.length < 3) return;
        info.langMode = { type: 'single', lang: c };
        info.lang     = null;
        info.langRule = null;
    };

    const swapAndMatch = msg.match(/\bswap\s+([a-zA-Z]+)\s+and\s+([a-zA-Z]+)/i);
    if (swapAndMatch) {
        const langA = swapAndMatch[1].toLowerCase(), langB = swapAndMatch[2].toLowerCase();
        if (langA !== langB) {
            info.langMode = { type: 'swap', pairs: [
                { input: langA, output: langB },
                { input: langB, output: langA },
            ]};
            info.lang = null; info.langRule = null;
        }
    } else {
        const arrowPat = /(?:(?:is\s+)?in\s+)?([a-z]{3,20})\s*[→→>]\s*(?:convert|translate|reply|respond)?\s*(?:it\s+)?(?:to|into)\s+([a-z]{3,20})/gi;
        const arrowPairs = [];
        let am;
        while ((am = arrowPat.exec(msg)) !== null) {
            const inp = am[1].toLowerCase(), out = am[2].toLowerCase();
            if (inp !== out && !arrowPairs.find(p => p.input === inp))
                arrowPairs.push({ input: inp, output: out });
        }
        if (arrowPairs.length >= 1) {
            info.langMode = { type: 'swap', pairs: arrowPairs };
            info.lang = null; info.langRule = null;
        } else if (uniqueLangs.length >= 2 && hasLangVerb) {
            const pairs = [];
            let m;

            const patA = /(?:reply|respond|convert|translat\w*)\s+(?:it\s+)?(?:to|into|in)\s+([a-z]+)\s+(?:if|when)\s+(?:I\s+)?(?:send|write|speak|use|type)\s+(?:a?\s+)?(?:in\s+)?([a-z]+)/gi;
            while ((m = patA.exec(msg)) !== null) {
                const out = m[1].toLowerCase(), inp = m[2].toLowerCase();
                if (uniqueLangs.includes(out) && uniqueLangs.includes(inp) && out !== inp)
                    pairs.push({ input: inp, output: out });
            }

            const patB = /(?:if|when)\s+(?:I\s+)?(?:send|write|speak|use|type)\s+(?:a?\s+)?(?:in\s+)?([a-z]+)[^.]*?(?:reply|respond|convert|translat\w*)\s+(?:it\s+)?(?:to|into|in)\s+([a-z]+)/gi;
            while ((m = patB.exec(msg)) !== null) {
                const inp = m[1].toLowerCase(), out = m[2].toLowerCase();
                if (uniqueLangs.includes(inp) && uniqueLangs.includes(out) && inp !== out &&
                    !pairs.find(p => p.input === inp && p.output === out))
                    pairs.push({ input: inp, output: out });
            }

            if (pairs.length >= 1) {
                info.langMode = { type: 'swap', pairs };
                info.lang     = null;
                info.langRule = null;
            }
        } else if (uniqueLangs.length === 1 && hasLangVerb) {
            setLang(uniqueLangs[0]);
        } else {
            const rev = msg.match(/\b([a-zA-Z\u0600-\u06FF]{3,20})\s+(?:me|mein|mai|main)\s+(?:batao|bolo|likho|baat|reply|jawab|answer|karo)/i)
                     || msg.match(/(?:mujhe|mujhko)\s+([a-zA-Z\u0600-\u06FF]{3,20})\s+(?:me|mein|mai|main)/i)
                     || msg.match(/(?:speak|talk|reply|respond|write|use|switch(?:\s+to)?)\s+(?:in\s+)?([a-zA-Z\u0600-\u06FF]{3,20})(?:\s|$|[.,!?])/i);
            if (rev) setLang(rev[1]);
        }
    }

    if (/(?:go\s+back|switch\s+back|back)\s+to\s+(?:english|normal|default|auto)|speak\s+english\s+again|use\s+english\s+again|stop\s+(?:speaking|using)\s+\w+|auto\s+(?:pe|par)\s+ao|auto\s+mode/i.test(msg)) {
        info.langMode = { type: 'default' };
        info.lang     = 'default';
        info.langRule = null;
    }

    return info;
}

// ─── Memory helpers ───────────────────────────────────────────────────────────
function getMemKey(senderId, chatId) {
    return chatId.endsWith('@g.us') ? `${senderId}::${chatId}` : senderId;
}

function ensureMemory(memKey) {
    loadMemForKey(memKey);
}

function pushHistory(memKey, role, content) {
    const mem = chatMemory.get(memKey);
    mem.messages.push({ role, content });
    if (mem.messages.length > 100) mem.messages.splice(0, mem.messages.length - 100);
    scheduleSaveForKey(memKey);
}

// ─── Extract quoted/replied-to message text ───────────────────────────────────
function extractQuotedContext(message) {
    const ctx = getContextInfo(message);
    if (!ctx?.quotedMessage) return null;
    const q = ctx.quotedMessage;
    const text = getQuotedText(q);
    const type = !text ? (
        q.imageMessage    ? 'image'    :
        q.videoMessage    ? 'video'    :
        q.stickerMessage  ? 'sticker'  :
        q.audioMessage    ? 'audio'    :
        q.documentMessage ? 'document' : 'message'
    ) : '';
    return { text, type };
}

function buildQueryWithQuoted(query, quoted, langMode) {
    if (!quoted) return query || null;
    const { text: qText, type: qType } = quoted;

    const isOwnResponse = qText && qText.startsWith(RIMURU_RESPONSE_MARKER);
    const effectiveText = isOwnResponse ? '' : qText;
    const effectiveType = isOwnResponse ? '' : qType;

    if (langMode?.type === 'swap' && effectiveText) {
        return `[Translator mode] Translate the following message using the active swap rules. Reply with ONLY the translated text.\nMessage: "${effectiveText}"`;
    }

    if (query && effectiveText) return `${query}\n\n(replying to: "${effectiveText}")`;
    if (query)                  return query;
    if (effectiveText)          return effectiveText;
    if (effectiveType)          return `What can you tell me about this ${effectiveType}?`;
    return null;
}

// ─── Direct Instant Response ──────────────────────────────────────────────────
async function rimuruRespond(sock, chatId, message, userText, senderId, mentions = []) {
    const memKey = getMemKey(senderId, chatId);
    ensureMemory(memKey);
    const mem  = chatMemory.get(memKey);
    const info = extractUserInfo(userText);
    if (Object.keys(info).length)
        mem.userInfo = { ...mem.userInfo, ...info };

    pushHistory(memKey, 'user', userText);

    const response = await getAIResponse(userText, {
        messages: mem.messages,
        userInfo: mem.userInfo,
        senderId,
        isOwner: isPairingOwnerNumber(senderId, sock),
        detectedLang: detectLang(userText),
    });

    const fullReply = response || "*slime wobbles* Ciel hit a magicule surge — couldn't process that one. Try again in a second.";
    pushHistory(memKey, 'assistant', fullReply);

    try {
        const sent = await sock.sendMessage(
            chatId,
            { text: rimuruBox(fullReply.trim()), mentions },
            { quoted: message }
        );
        rememberRimuruResponse(sent?.key);
    } catch (e) {
        console.error('[Rimuru] Failed to send message:', e.message);
    }
}

// ─── $chatbot on/off/status — admin command — PRO DOUBLE BOX ─────────────────
async function handleChatbotCommand(sock, chatId, message, match) {
    if (!match) {
        return sock.sendMessage(chatId, {
            text: proBox('CHATBOT', '🤖', [
                '🤖 Usage: $chatbot <on/off/status>',
                '📚 Example: $chatbot on',
                '💡 Tip: Mention Rimuru to auto reply'
            ]),
            quoted: message,
        });
    }

    const data   = loadUserGroupData();
    const sender = message.key.participant || message.key.remoteJid;
    const isGroup = chatId.endsWith('@g.us');

    if (!isGroup) {
        if (match === 'on')     { data.chatbot[chatId] = true;  saveUserGroupData(data); return sock.sendMessage(chatId, { text: proBox('ACTIVE', '✅', ['✅ Rîmîřǔ Tempest enabled for this chat 🔵']), quoted: message }); }
        if (match === 'off')    { delete data.chatbot[chatId];   saveUserGroupData(data); return sock.sendMessage(chatId, { text: proBox('OFFLINE', '❌', ['❌ Rîmîřǔ Tempest has returned to Tempest']), quoted: message }); }
        if (match === 'status') return sock.sendMessage(chatId, { text: proBox('STATUS', '📊', [`📊 Status: ${data.chatbot[chatId] ? '✅ active' : '❌ inactive'}`]), quoted: message });
        return;
    }

    let isAdmin = false;
    try {
        const meta = await sock.groupMetadata(chatId);
        const p = meta.participants.find(p => p.id === sender || p.lid === sender);
        isAdmin = p && (p.admin === 'admin' || p.admin === 'superadmin');
    } catch {}

    if (!isAdmin) return sock.sendMessage(chatId, { text: proBox('ERROR', '❌', ['❌ Only group admins can use this command.']), quoted: message });

    if (match === 'on') {
        if (data.chatbot[chatId]) return sock.sendMessage(chatId, { text: proBox('ALREADY', '🔵', ['🔵 Rîmîřǔ Tempest is already ruling this domain.']), quoted: message });
        data.chatbot[chatId] = true; saveUserGroupData(data);
        return sock.sendMessage(chatId, { text: proBox('ARRIVED', '✅', ['✅ Rîmîřǔ Tempest has arrived!', '🔵 Mention Rimuru and he will respond', '🧠 Ciel: All systems online']), quoted: message });
    }
    if (match === 'off') {
        if (!data.chatbot[chatId]) return sock.sendMessage(chatId, { text: proBox('GONE', '🔵', ['🔵 Rîmîřǔ Tempest is already gone.']), quoted: message });
        delete data.chatbot[chatId]; saveUserGroupData(data);
        return sock.sendMessage(chatId, { text: proBox('RETURNED', '✅', ['✅ Rîmîřǔ has returned to Jura Tempest', '💡 Use $chatbot on to summon back']), quoted: message });
    }
    if (match === 'status') {
        return sock.sendMessage(chatId, { text: proBox('STATUS', '📊', [`📊 Status: ${data.chatbot[chatId] ? '✅ active — ruling this domain' : '❌ inactive — returned to Tempest'}`]), quoted: message });
    }
    return sock.sendMessage(chatId, { text: proBox('USAGE', '❓', ['❓ Usage: $chatbot [on/off/status]']), quoted: message });
}

// ─── Name Trigger ─────────────────────────────────────────────────────────────
async function handleRimuruNameTrigger(sock, chatId, message, userMessage, senderId) {
    if (userMessage.startsWith(RIMURU_RESPONSE_MARKER)) return;

    const isGroup = chatId.endsWith('@g.us');
    if (isGroup) {
        const data = loadUserGroupData();
        if (!data?.chatbot?.[chatId]) return;
    }

    if (!claimMessage(message)) return;

    const memKey   = getMemKey(senderId, chatId);
    const langMode = chatMemory.get(memKey)?.userInfo?.langMode;
    const quoted   = extractQuotedContext(message);
    const finalQuery = buildQueryWithQuoted(userMessage, quoted, langMode);
    await rimuruRespond(sock, chatId, message, finalQuery || userMessage, senderId);
}

// ─── $rimuru / $botchat direct command ───────────────────────────────────────
async function handleBotchatCommand(sock, chatId, message, query, senderId) {
    const isGroup = chatId.endsWith('@g.us');

    if (isGroup) {
        const data = loadUserGroupData();
        if (!data?.chatbot?.[chatId]) {
            return sock.sendMessage(chatId, {
                text: proBox('SUMMON', '🔵', [
                    '🔵 Rimuru not summoned yet',
                    '📚 Example: $chatbot on'
                ]),
                quoted: message,
            });
        }
    }

    const memKey2    = getMemKey(senderId, chatId);
    const langMode2  = chatMemory.get(memKey2)?.userInfo?.langMode;
    const quotedCtx  = extractQuotedContext(message);
    const finalQuery = buildQueryWithQuoted(query, quotedCtx, langMode2) || query || 'Greetings! Introduce yourself as Rîmîřǔ Tempest.';

    await rimuruRespond(sock, chatId, message, finalQuery, senderId);
}

// ─── @mention and reply-to-bot / DM ──────────────────────────────────────────
async function handleChatbotResponse(sock, chatId, message, userMessage, senderId) {
    if (userMessage.startsWith(RIMURU_RESPONSE_MARKER)) return;

    const isGroup = chatId.endsWith('@g.us');

    // DM: hamesha jawab. Group: sirf jab chatbot on ho.
    if (isGroup) {
        const data = loadUserGroupData();
        if (!data?.chatbot?.[chatId]) return;
    }

    try {
        const botId  = sock.user.id.split(':')[0];
        const botLid = (sock.user.lid || '').split('@')[0].split(':')[0];

        const isMentioned = userMessage.includes(`@${botId}`);

        const replyContext = getContextInfo(message);
        const quotedParticipant = replyContext?.participant || '';
        const quotedPNum = quotedParticipant.split('@')[0].split(':')[0];
        const isQuotedByBot = !!(quotedParticipant && (
            quotedPNum === botId || (botLid && quotedPNum === botLid)
        ));
        const quotedIsRimuruResponse = !!(
            replyContext?.stanzaId &&
            rimuruResponseMessageIds.has(replyContext.stanzaId)
        ) || isRimuruResponseMessage(replyContext?.quotedMessage);
        const isReplyToBot = isQuotedByBot && quotedIsRimuruResponse;

        // Group me bina mention/reply ke naam-trigger sambhalta hai
        if (isGroup && !isMentioned && !isReplyToBot) return;

        const cleanedMessage = userMessage
            .replace(new RegExp(`@${botId}`, 'g'), '')
            .replace(/^\$/, '')
            .trim();
        if (!cleanedMessage && !extractQuotedContext(message)) return;

        if (!claimMessage(message)) return;

        const quoted     = extractQuotedContext(message);
        const memKey3   = getMemKey(senderId, chatId);
        const langMode3 = chatMemory.get(memKey3)?.userInfo?.langMode;
        const finalQuery = buildQueryWithQuoted(cleanedMessage, quoted, langMode3) || cleanedMessage;
        if (!finalQuery) return;

        const mentions = isMentioned ? [senderId] : [];
        await rimuruRespond(sock, chatId, message, finalQuery, senderId, mentions);

    } catch (err) {
        console.error('[Rimuru:chatbotResponse]', err.message);
    }
}

module.exports = {
    handleChatbotCommand,
    handleChatbotResponse,
    handleBotchatCommand,
    handleRimuruNameTrigger,
    loadUserGroupData,
    saveUserGroupData,
};
