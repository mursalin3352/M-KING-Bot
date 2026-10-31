'use strict';
/**
 * aitools.js — Extra AI utility commands
 * $humanize / $summarize / $rewrite / $grammar
 * Primary: text.pollinations.ai (free, no key, tested)
 * Fallback: gifted overchat
 */

const axios = require('axios');
const { get } = require('../lib/gifted');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const MAX_PROMPT = 4000;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function react(sock, message, emoji) {
    try { await sock.sendMessage(message.key.remoteJid, { react: { text: emoji, key: message.key } }); } catch {}
}

function getInput(message, sliceWords = 1) {
    const raw = message.message?.conversation ||
                message.message?.extendedTextMessage?.text || '';
    const fromCmd = raw.trim().split(/\s+/).slice(sliceWords).join(' ').trim();

    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedText =
        quoted?.conversation ||
        quoted?.extendedTextMessage?.text ||
        quoted?.imageMessage?.caption ||
        quoted?.videoMessage?.caption || '';

    return (quotedText ? quotedText + (fromCmd ? '\n\n' + fromCmd : '') : fromCmd).trim();
}

// ── AI call: pollinations (tested) → gifted (fallback) ────────────────────────

async function askAI(system, text) {
    const prompt = `${system}\n\nText:\n${text}`.slice(0, MAX_PROMPT);
    const enc = encodeURIComponent(prompt);
    const tried = [];

    const urls = [
        `https://text.pollinations.ai/${enc}?model=openai`,
        `https://text.pollinations.ai/${enc}`,
    ];

    for (const u of urls) {
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const res = await axios.get(u, {
                    timeout: 60000, responseType: 'text',
                    headers: { 'User-Agent': UA },
                    validateStatus: (s) => s >= 200 && s < 300,
                });
                const out = String(res.data ?? '').trim();
                if (out.length > 1 && !/^\s*\{/.test(out)) return out;
                tried.push('pollinations:empty');
                break;
            } catch (e) {
                tried.push('pollinations:' + (e.response?.status || e.code || e.message));
                if (e.response?.status === 429) await new Promise((r) => setTimeout(r, 1500));
            }
        }
    }

    try {
        const data = await get('/ai/overchat', { q: prompt, model: 'deepseek' }, 60000);
        const r = typeof data?.result === 'string'
            ? data.result
            : (data?.result?.answer || data?.result?.message || data?.answer);
        if (r && String(r).trim()) return String(r).trim();
        tried.push('gifted:no-result');
    } catch (e) { tried.push('gifted:' + e.message); }

    throw new Error(tried.join(' | '));
}

async function aiToolReply(sock, chatId, message, systemPrompt, userText, label, emoji) {
    if (!userText) {
        const cmd = (message.message?.conversation || message.message?.extendedTextMessage?.text || '')
            .trim().split(' ')[0];
        return sock.sendMessage(chatId, {
            text: `${emoji} *${label.toUpperCase()}*\n\nUsage: *${cmd} <text>*\nor reply to a message with *${cmd}*\n\n_M-KING_ ⚡`
        }, { quoted: message });
    }

    await react(sock, message, '⏳');

    try {
        const reply = await askAI(systemPrompt, userText);

        await react(sock, message, '✅');
        await sock.sendMessage(chatId, {
            text: `${emoji} *${label.toUpperCase()}*\n\n${reply.trim()}\n\n_M-KING_ ⚡`
        }, { quoted: message });
    } catch (err) {
        console.error(`[aitools:${label}]`, err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, {
            text: `❌ *${label}* failed.\n\n_${err.message.slice(0, 160)}_\n\n_M-KING_ ⚡`
        }, { quoted: message });
    }
}

// ── Commands ──────────────────────────────────────────────────────────────────

async function humanizeCommand(sock, chatId, message) {
    await aiToolReply(sock, chatId, message,
        'Rewrite the text in very simple, easy, natural human language. Use common daily words. Keep it short and easy to understand for everyone. Keep same meaning and same language as input.',
        getInput(message), 'Humanize', '🧑');
}

async function summarizeCommand(sock, chatId, message) {
    await aiToolReply(sock, chatId, message,
        'Summarize the text in VERY SIMPLE and EASY language. Use 3-5 short bullet points. Use easy words that a 10 year old can understand. Keep same language as input. Make it short and clear, not complicated.',
        getInput(message), 'Summarize', '📝');
}

async function rewriteCommand(sock, chatId, message) {
    await aiToolReply(sock, chatId, message,
        'Rewrite the text in simple, clear, easy to read language. Make it more natural and easy to understand. Use simple words. Keep same meaning and same language as input. Do NOT make it difficult or professional.',
        getInput(message), 'Rewrite', '✍️');
}

async function grammarCommand(sock, chatId, message) {
    await aiToolReply(sock, chatId, message,
        'Fix grammar and spelling only. Keep the language simple and same as input. Return only corrected version. Do not make it more difficult.',
        getInput(message), 'Grammar Fix', '✏️');
}

module.exports = { humanizeCommand, summarizeCommand, rewriteCommand, grammarCommand };
