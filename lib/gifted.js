'use strict';
/**
 * lib/gifted.js — GiftedTech API helper (primary API for dara-bot)
 *
 * Hardened: SSL-bypass, https→http fallback, multi-host failover,
 * retry+backoff, dead-host circuit breaker, sticky fast-path host.
 * Every export + signature is unchanged.
 */

const axios = require('axios');
const https = require('https');
const http = require('http');

const KEY = process.env.GIFTED_API_KEY || 'gifted-api_p1r5icplshukpe2x';
const UA  = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/** Origin fallbacks — order matters. https first, http retry same host, then mirrors. */
const ROOTS = [
    'https://api.gifted.co.ke',
    'http://api.gifted.co.ke',
    'https://api.giftedtech.web.id',
    'https://api.giftedtech.my.id',
];

const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 32, rejectUnauthorized: false });
const httpAgent  = new http.Agent({ keepAlive: true, maxSockets: 32 });

const client = axios.create({
    timeout: 30000,
    maxRedirects: 5,
    httpsAgent,
    httpAgent,
    decompress: true,
    headers: { 'User-Agent': UA, Accept: 'application/json, text/plain, */*', 'Accept-Encoding': 'gzip, deflate' },
    validateStatus: (s) => s >= 200 && s < 300,
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let preferred = 0;
const dead = new Map(); // root -> until timestamp

function orderedRoots() {
    const now = Date.now();
    const live = ROOTS.filter((r) => (dead.get(r) || 0) < now);
    const list = live.length ? live : ROOTS.slice();
    const pref = ROOTS[preferred];
    if (pref && list.includes(pref)) {
        list.splice(list.indexOf(pref), 1);
        list.unshift(pref);
    }
    return list;
}

function joinPath(path) {
    const p = String(path || '');
    return p.startsWith('/') ? p : '/' + p;
}

function buildUrl(path, params = {}, root = ROOTS[0]) {
    const u = new URL(root + joinPath(path));
    u.searchParams.set('apikey', KEY);
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') u.searchParams.set(String(k), String(v));
    }
    return u.toString();
}

/**
 * Core request. Returns parsed JSON, or Buffer when responseType is arraybuffer.
 * Never throws on a single host failure — tries every root before giving up.
 */
async function request(path, params = {}, timeout = 30000, responseType = 'json') {
    const errs = [];

    for (const root of orderedRoots()) {
        const url = buildUrl(path, params, root);

        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const res = await client.get(url, { timeout, responseType });

                if (responseType === 'arraybuffer') {
                    const buf = Buffer.from(res.data);
                    if (!buf.length) throw new Error('empty buffer');
                    preferred = ROOTS.indexOf(root);
                    return buf;
                }

                const data = res.data;
                if (typeof data === 'string' && /^\s*</.test(data)) throw new Error('html response');
                preferred = ROOTS.indexOf(root);
                return data;

            } catch (e) {
                const status = e.response?.status;
                errs.push(`${root} ${e.code || status || e.message}`);

                // 404 = host alive, path missing → move to next host immediately
                if (status === 404) break;

                // 4xx (except 408/429) = our fault, no point retrying
                if (status && status < 500 && status !== 408 && status !== 429) break;

                if (attempt === 0) { await sleep(300); continue; }
                dead.set(root, Date.now() + 60000); // circuit break this host for 60s
            }
        }
    }

    throw new Error('gifted api failed → ' + errs.slice(0, 5).join(' | '));
}

/* ── Base constants (primary host kept for compatibility) ─────────────────── */

const BASE          = 'https://api.gifted.co.ke/api';
const DAVID_BASE    = 'https://apis.davidcyril.name.ng';
const TOOLS_BASE    = 'https://api.gifted.co.ke/api/tools';
const ANIME_BASE    = 'https://api.gifted.co.ke/api/anime';
const FUN_BASE      = 'https://api.gifted.co.ke/api/fun';
const STALKER_BASE  = 'https://api.gifted.co.ke/api/stalk';
const SEARCH_BASE   = 'https://api.gifted.co.ke/api/search';
const TEXTPRO_BASE  = 'https://api.gifted.co.ke/api/textpro';
const TEMPGEN_BASE  = 'https://api.gifted.co.ke/api/tempgen';
const EPHOTO_BASE   = 'https://api.gifted.co.ke/api/ephoto360';
const GSPORTS_BASE  = 'https://api.gifted.co.ke/api';

/* ── Gifted wrappers ─────────────────────────────────────────────────────── */

/** GET to GiftedTech API root (/api) */
async function get(path, params = {}, timeout = 30000) {
    return request('/api' + joinPath(path), params, timeout);
}

/** Gifted Tools API → parsed JSON */
async function toolsGet(endpoint, params = {}, timeout = 30000) {
    return request('/api/tools/' + String(endpoint).replace(/^\/+/, ''), params, timeout);
}

/** Gifted Tools API → Buffer (binary image/PDF/ZIP) */
async function toolsBuf(endpoint, params = {}, timeout = 45000) {
    return request('/api/tools/' + String(endpoint).replace(/^\/+/, ''), params, timeout, 'arraybuffer');
}

/** Gifted Anime API */
async function animeGet(endpoint, params = {}, timeout = 20000) {
    return request('/api/anime/' + String(endpoint).replace(/^\/+/, ''), params, timeout);
}

/** Gifted Fun API */
async function funGet(endpoint, params = {}, timeout = 15000) {
    return request('/api/fun/' + String(endpoint).replace(/^\/+/, ''), params, timeout);
}

/** Gifted Stalker API */
async function stalkerGet(endpoint, params = {}, timeout = 25000) {
    return request('/api/stalk/' + String(endpoint).replace(/^\/+/, ''), params, timeout);
}

/** Gifted Search API */
async function searchGet(endpoint, params = {}, timeout = 20000) {
    return request('/api/search/' + String(endpoint).replace(/^\/+/, ''), params, timeout);
}

/** Gifted Textpro API */
async function textproGet(endpoint, params = {}, timeout = 25000) {
    return request('/api/textpro/' + String(endpoint).replace(/^\/+/, ''), params, timeout);
}

/** Gifted Tempgen API */
async function tempgenGet(endpoint, params = {}, timeout = 20000) {
    return request('/api/tempgen/' + String(endpoint).replace(/^\/+/, ''), params, timeout);
}

/** Gifted Ephoto360 API */
async function ephotoGet(endpoint, params = {}, timeout = 25000) {
    return request('/api/ephoto360/' + String(endpoint).replace(/^\/+/, ''), params, timeout);
}

/** Gifted Sports API (football / basketball / sports) */
async function sportsGet(endpoint, params = {}, timeout = 20000) {
    return request('/api/' + String(endpoint).replace(/^\/+/, ''), params, timeout);
}

/* ── David Cyril API (secondary, no key) ─────────────────────────────────── */

async function davidGet(path, params = {}, timeout = 20000) {
    const u = new URL(DAVID_BASE + joinPath(path));
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') u.searchParams.set(String(k), String(v));
    }

    let last;
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const res = await client.get(u.toString(), { timeout });
            const data = res.data;
            if (typeof data === 'string' && /^\s*</.test(data)) throw new Error('html response');
            return data;
        } catch (e) {
            last = e;
            if (e.response?.status && e.response.status < 500) break;
            await sleep(400 * (attempt + 1));
        }
    }
    throw new Error('david api failed → ' + (last?.code || last?.message || 'unknown'));
}

module.exports = {
    buildUrl, request, get, davidGet,
    animeGet, funGet, stalkerGet, toolsGet, toolsBuf,
    searchGet, textproGet, tempgenGet, sportsGet, ephotoGet,
    BASE, DAVID_BASE, ANIME_BASE, FUN_BASE, STALKER_BASE, SEARCH_BASE,
    TEXTPRO_BASE, TEMPGEN_BASE, GSPORTS_BASE, EPHOTO_BASE, KEY,
};
