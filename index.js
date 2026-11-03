// Start capturing console output into the in-memory log buffer ASAP
require('./lib/logger');

/**
 * M-KINGMD- A WhatsApp Bot
 * Copyright (c) 2024 M-KING SHOP
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 * 
 * Credits:
 * - Developed by M-KING SHOP
 * - YouTube Channel: M-KING
 * - GitHub: m-king
 */
require('./settings')
const { Boom } = require('@hapi/boom')
const fs = require('fs')
const chalk = require('chalk')
const FileType = require('file-type')
const path = require('path')
const axios = require('axios')

// Initialize FFmpeg path for hosting servers & local environments
try {
    const getFfmpegPath = require('./lib/getFfmpeg');
    const ffmpegBin = getFfmpegPath();
    if (ffmpegBin && fs.existsSync(ffmpegBin)) {
        process.env.FFMPEG_PATH = ffmpegBin;
        try {
            const ff = require('fluent-ffmpeg');
            ff.setFfmpegPath(ffmpegBin);
        } catch {}
    }
} catch {}
const { handleMessages, handleGroupParticipantUpdate, handleStatus } = require('./main');
const { handleAutotypingForMessage } = require('./commands/autotyping'); // M-KING AUTOTYPING FIX ADDED
const PhoneNumber = require('awesome-phonenumber')
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('./lib/exif')
const { smsg, isUrl, generateMessageTag, getBuffer, getSizeMedia, fetch, await, sleep, reSize } = require('./lib/myfunc')
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    generateForwardMessageContent,
    prepareWAMessageMedia,
    generateWAMessageFromContent,
    downloadContentFromMessage,
    jidDecode,
    proto,
    jidNormalizedUser,
    makeCacheableSignalKeyStore,
    delay
} = require("@whiskeysockets/baileys")
const NodeCache = require("node-cache")
const pino = require("pino")
const readline = require("readline")
const { parsePhoneNumber } = require("libphonenumber-js")
let PHONENUMBER_MCC;
try {
    ({ PHONENUMBER_MCC } = require('@whiskeysockets/baileys/lib/Utils/generics'));
} catch {
    try {
        ({ PHONENUMBER_MCC } = require('@whiskeysockets/baileys/lib/Utils'));
    } catch {
        PHONENUMBER_MCC = {};
    }
}
const { rmSync, existsSync } = require('fs')
const { join } = require('path')

const store = require('./lib/lightweight_store')
const sessionRegistry = require('./lib/sessionRegistry')

const { writePid, isDuplicatePanelRestart } = require('./lib/selfRestart');
if (isDuplicatePanelRestart()) process.exit(0);
writePid();

const _startupMsgSentMap = new Map();

store.readFromFile()
const settings = require('./settings')
setInterval(() => store.writeToFile(), settings.storeWriteInterval || 10000)

setInterval(() => {
    if (global.gc) {
        global.gc()
        console.log('🧹 Garbage collection completed')
    }
}, 60_000)

let _highMemCount = 0;
setInterval(() => {
    const heapMB = process.memoryUsage().heapUsed / 1024 / 1024;
    if (heapMB > 380) {
        _highMemCount++;
        if (_highMemCount >= 2) {
            console.log(`⚠️ Heap sustained above 380 MB (${heapMB.toFixed(0)} MB) — restarting...`);
            process.exit(1);
        }
    } else {
        _highMemCount = 0;
    }
}, 30_000);

let phoneNumber = (process.env.PAIRING_NUMBER || process.env.OWNER_NUMBER || '').replace(/\D/g, '')
let owner = JSON.parse(fs.readFileSync('./data/owner.json'))

global.botname = "M-KING"
global.themeemoji = "•"
const pairingCode = !!phoneNumber || process.argv.includes("--pairing-code")
const useMobile = process.argv.includes("--mobile")

const rl = process.stdin.isTTY ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null
const question = (text) => {
    if (rl) {
        return new Promise((resolve) => rl.question(text, resolve))
    } else {
        return Promise.resolve(phoneNumber)
    }
}

async function autoJoinCommunity(sock) {
    try {
        const autojoinPath = './data/autojoin.json';
        if (!fs.existsSync(autojoinPath)) {
            const defaultConfig = {
                enabled: true,
                channel: "120363422591784062@newsletter",
                welcomeMessage: ""
            };
            fs.writeFileSync(autojoinPath, JSON.stringify(defaultConfig, null, 2));
        }
        const config = JSON.parse(fs.readFileSync(autojoinPath, 'utf8'));
        if (!config.enabled) return;
        console.log(chalk.cyan('🤖 Auto-join feature enabled...'));
    } catch (error) {
        console.error('Auto-join error:', error);
    }
}

function restoreSessionFromEnv(sessionDir = 'session', envVarName = 'SESSION_ID') {
    const encoded = process.env[envVarName];
    if (!encoded) return;
    const dir      = path.join(process.cwd(), sessionDir);
    const credsFile = path.join(dir, 'creds.json');
    if (fs.existsSync(credsFile)) return;
    try {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const decoded = Buffer.from(encoded, 'base64').toString('utf8');
        JSON.parse(decoded);
        fs.writeFileSync(credsFile, decoded);
        console.log(`[session:${sessionDir}] Restored creds.json from $${envVarName}`);
    } catch (e) {
        console.error(`[session:${sessionDir}] Failed to restore from $${envVarName}:`, e.message);
    }
}

function saveSessionToEnv(sessionDir = 'session', envVarName = 'SESSION_ID') {
    try {
        const credsFile = path.join(process.cwd(), sessionDir, 'creds.json');
        if (!fs.existsSync(credsFile)) return;
        const encoded = Buffer.from(fs.readFileSync(credsFile, 'utf8')).toString('base64');
        const envPath = path.join(process.cwd(), '.env');
        let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
        const regex = new RegExp(`^${envVarName}=.*`, 'm');
        if (regex.test(content)) {
            content = content.replace(regex, `${envVarName}=${encoded}`);
        } else {
            content = content.trimEnd() + `\n${envVarName}=${encoded}\n`;
        }
        fs.writeFileSync(envPath, content);
    } catch (e) {
    }
}

async function startSession(config = {}) {
    const sessionId      = config.id        || 'default';
    const sessionName    = config.name      || settings.sessionName || global.botname || 'M-KING';
    const sessionDir     = config.sessionDir|| 'session';
    const sessionOwnerNum= (config.ownerNumber || '').replace(/\D/g, '') || phoneNumber;

    sessionRegistry.setConnecting(sessionId, sessionName);
    console.log(chalk.cyan(`[${sessionName}] Starting session (dir: ${sessionDir})…`));

    try {
        let { version, isLatest } = await fetchLatestBaileysVersion()
        if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
        const envSessionVar = config.envSessionVar || (sessionDir === 'session' ? 'SESSION_ID' : null);
        if (envSessionVar) restoreSessionFromEnv(sessionDir, envSessionVar);
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir)

        let sessionConnected = false;
        const msgRetryCounterCache = new NodeCache()

        const sessionPairingCode = !!sessionOwnerNum || process.argv.includes("--pairing-code");

        const XeonBotInc = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: !sessionPairingCode,
            browser: ["Ubuntu", "Chrome", "20.0.04"],
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
            },
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true,
            syncFullHistory: false,
            getMessage: async (key) => {
                const jid = jidNormalizedUser(key.remoteJid);
                const msg = await store.loadMessage(jid, key.id);
                return msg?.message || undefined;
            },
            msgRetryCounterCache,
            defaultQueryTimeoutMs: 15000,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
        })

        XeonBotInc._sessionId      = sessionId;
        XeonBotInc._sessionName    = sessionName;
        XeonBotInc._pairingNumber  = sessionOwnerNum;
        XeonBotInc._ownerNumber    = (process.env.OWNER_NUMBER || '').replace(/\D/g, '');

        XeonBotInc.ev.on('creds.update', async () => {
            await saveCreds();
            if (sessionConnected) {
                const envVar = config.envSessionVar || (sessionDir === 'session' ? 'SESSION_ID' : null);
                if (envVar) saveSessionToEnv(sessionDir, envVar);
            }
        })

    store.bind(XeonBotInc.ev)

    // Message handling - M-KING FIXED WITH AUTOTYPING
    XeonBotInc.ev.on('messages.upsert', async chatUpdate => {
        try {
            const mek = chatUpdate.messages[0]
            if (!mek.message) return

            mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message
            if (mek.key && mek.key.remoteJid === 'status@broadcast') {
                await handleStatus(XeonBotInc, chatUpdate);
                return;
            }
            if (mek.key.id.startsWith('BAE5') && mek.key.id.length === 16) return

            // ===== M-KING AUTOTYPING FIX - ADDED, NOTHING DELETED =====
            try {
                const chatJid = mek.key.remoteJid;
                const userText = mek.message?.conversation || mek.message?.extendedTextMessage?.text || mek.message?.imageMessage?.caption || "hello";
                if (!mek.key.fromMe && chatJid) {
                    // isme await hai taake typing dikhe phir reply jaye
                    await handleAutotypingForMessage(XeonBotInc, chatJid, userText);
                }
            } catch (e) {
                // autotyping fail bhi ho to bot chalta rahe
            }
            // ===== END AUTOTYPING FIX =====

            try {
                await handleMessages(XeonBotInc, chatUpdate, true)
            } catch (err) {
                console.error("Error in handleMessages:", err)
                if (mek.key && mek.key.remoteJid) {
                    await XeonBotInc.sendMessage(mek.key.remoteJid, {
                        text: '❌ An error occurred while processing your message.'
                    }).catch(console.error);
                }
            }
        } catch (err) {
            console.error("Error in messages.upsert:", err)
        }
    })

    XeonBotInc.decodeJid = (jid) => {
        if (!jid) return jid
        if (/:\d+@/gi.test(jid)) {
            let decode = jidDecode(jid) || {}
            return decode.user && decode.server && decode.user + '@' + decode.server || jid
        } else return jid
    }

    XeonBotInc.ev.on('contacts.update', update => {
        for (let contact of update) {
            let id = XeonBotInc.decodeJid(contact.id)
            if (store && store.contacts) store.contacts[id] = { id, name: contact.notify }
        }
    })

    XeonBotInc.getName = (jid, withoutContact = false) => {
        id = XeonBotInc.decodeJid(jid)
        withoutContact = XeonBotInc.withoutContact || withoutContact
        let v
        if (id.endsWith("@g.us")) return new Promise(async (resolve) => {
            v = store.contacts[id] || {}
            if (!(v.name || v.subject)) v = XeonBotInc.groupMetadata(id) || {}
            resolve(v.name || v.subject || PhoneNumber('+' + id.replace('@s.whatsapp.net', '')).getNumber('international'))
        })
        else v = id === '0@s.whatsapp.net' ? {
            id,
            name: 'WhatsApp'
        } : id === XeonBotInc.decodeJid(XeonBotInc.user.id) ?
            XeonBotInc.user :
            (store.contacts[id] || {})
        return (withoutContact ? '' : v.name) || v.subject || v.verifiedName || PhoneNumber('+' + jid.replace('@s.whatsapp.net', '')).getNumber('international')
    }

    XeonBotInc.public = true
    XeonBotInc.serializeM = (m) => smsg(XeonBotInc, m, store)

    if (sessionPairingCode && !XeonBotInc.authState.creds.registered) {
        if (useMobile) throw new Error('Cannot use pairing code with mobile api')

        let pairingPhone = sessionOwnerNum;
        const pairingKey = `phoneNumber_${sessionId}`;
        if (!pairingPhone && global[pairingKey]) {
            pairingPhone = global[pairingKey];
        } else if (!pairingPhone) {
            pairingPhone = await question(chalk.bgBlack(chalk.greenBright(`[${sessionName}] Please type your WhatsApp number 😍\nFormat: 2347030626048 (without + or spaces) : `)))
            pairingPhone = pairingPhone.replace(/[^0-9]/g, '')
            const pn = require('awesome-phonenumber');
            if (!pn('+' + pairingPhone).isValid()) {
                console.log(chalk.red(`[${sessionName}] Invalid phone number. Please enter full international number without + or spaces.`));
                process.exit(1);
            }
            global[pairingKey] = pairingPhone;
        }

        const requestNewPairingCode = async () => {
            try {
                let code = await XeonBotInc.requestPairingCode(pairingPhone)
                code = code?.match(/.{1,4}/g)?.join("-") || code
                console.log(chalk.black(chalk.bgGreen(`[${sessionName}] Pairing Code : `)), chalk.black(chalk.white(code)))
                console.log(chalk.yellow(`\nEnter this code in WhatsApp:\n1. Open WhatsApp → Settings → Linked Devices\n2. Tap "Link a Device"\n3. Choose "Link with phone number instead"\n4. Enter the code above\n\n⏱️  Code expires in ~60 seconds. A new one will be shown if needed.`))
            } catch (error) {
                console.error(`[${sessionName}] Error requesting pairing code:`, error)
                console.log(chalk.red(`[${sessionName}] Failed to get pairing code. Will retry on reconnect.`))
            }
        }
        setTimeout(requestNewPairingCode, 3000)
    }

    XeonBotInc.ev.on('connection.update', async (s) => {
        const { connection, lastDisconnect, qr } = s
        if (qr) {
            console.log(chalk.yellow('📱 QR Code generated. Please scan with WhatsApp.'))
        }
        if (connection === 'connecting') {
            console.log(chalk.yellow('🔄 Connecting to WhatsApp...'))
        }
        if (connection == "open") {
            sessionConnected = true;
            sessionRegistry.register(sessionId, { name: sessionName, sock: XeonBotInc, startTime: Date.now() });
            try {
                const { registerBot } = require('./lib/botRegistry');
                const botNum = XeonBotInc.user?.id?.split(':')[0] || '';
                if (botNum) registerBot(sessionName, botNum).catch(() => {});
            } catch {}
            global.phoneNumber = null;
            console.log(chalk.magenta(` `))
            console.log(chalk.yellow(`🌿Connected to => ` + JSON.stringify(XeonBotInc.user, null, 2)))
            try {
                const { seedEconomyOwner } = require('./commands/economy');
                const ownerJid = XeonBotInc.user?.id ? XeonBotInc.user.id.split(':')[0] + '@s.whatsapp.net' : null;
                const rawLid   = XeonBotInc.user?.lid || null;
                const ownerLid = rawLid ? rawLid.replace(/:\d+(?=@)/, '') : null;
                if (ownerJid) seedEconomyOwner(ownerJid, ownerLid);
            } catch (e) {
                console.log(chalk.yellow('⚠ Economy seed failed:', e.message));
            }
            try {
                const { start: startAutoUpdate } = require('./lib/autoUpdate');
                startAutoUpdate(XeonBotInc);
                console.log(chalk.cyan('🔄 Auto-update scheduler started'));
            } catch (e) {
                console.log(chalk.yellow('⚠ Auto-update scheduler failed to start:', e.message));
            }
            try {
                const restartStateFile = path.join(__dirname, 'data', 'restartState.json');
                if (fs.existsSync(restartStateFile)) {
                    const rData = JSON.parse(fs.readFileSync(restartStateFile, 'utf8'));
                    fs.unlinkSync(restartStateFile);
                    if (rData && rData.chatId) {
                        await delay(2000);
                        await XeonBotInc.sendMessage(rData.chatId, {
                            text: `╭─〔 ✅ *REBOOT COMPLETE* 〕─╮\n│\n│  ⚡ *M-KING Bot is back online!*\n│  🚀 _All features are active & ready._\n│\n╰──────────────────────────╯\n\n_M-KING_ ⚡`
                        });
                    }
                }
            } catch (e) {
                console.log(chalk.yellow('⚠ Restart notify failed:', e.message));
            }
            await autoJoinCommunity(XeonBotInc);
            try {
                await delay(3000);
                await XeonBotInc.newsletterFollow('120363422591784062@newsletter');
                console.log(chalk.green('✅ Successfully followed newsletter'));
            } catch (error) {
                console.log(chalk.yellow('⚠ Could not follow newsletter:'), error.message);
            }
            if (!_startupMsgSentMap.get(sessionId)) {
                _startupMsgSentMap.set(sessionId, true);
                try {
                    const botNumber = XeonBotInc.user.id.split(':')[0] + '@s.whatsapp.net';
                    const now = new Date();
                    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
                    const dateStr = `${now.getDate().toString().padStart(2,'0')}/${(now.getMonth()+1).toString().padStart(2,'0')}/${now.getFullYear()}`;
                    const connSettings = require('./settings');
                    const updateFlagPath = path.join(process.cwd(), 'data', 'update_done.json');
                    let updateFlag = null;
                    if (fs.existsSync(updateFlagPath)) {
                        try {
                            updateFlag = JSON.parse(fs.readFileSync(updateFlagPath, 'utf8'));
                            fs.unlinkSync(updateFlagPath);
                        } catch {}
                    }
                    if (updateFlag) {
                        const updateMsg = [
                            `⚡ *UPDATE DONE* ✅`,
                            ``,
                            `╭── INFO`,
                            `│ 🤖 ${global.botname || 'M-KING'}`,
                            `│ 📱 +${botNumber.replace('@s.whatsapp.net', '')}`,
                            `│ 📅 ${dateStr} • ${timeStr}`,
                            `│ ⚡ v${connSettings.version}`,
                            `╰─────────────────────`,
                            ``,
                            `╭── CMDS`,
                            `│ $menu → all`,
                            `│ $help → list`,
                            `│ $update → check`,
                            `│ $owner → contact`,
                            `╰─────────────────────`,
                            ``,
                            `🤖 Online & Ready`,
                        ].join('\n');
                        const target = updateFlag.chatId || botNumber;
                        try { await XeonBotInc.sendMessage(target, { text: updateMsg }); } catch {}
                    } else {
                        const startupMsg = [
                            `╔════════════════════════════════════╗`,
                            `║  ⚡  *M  -  K I N G  B O T*  ⚡    ║`,
                            `║  🟢  *Connected Successfully!*      ║`,
                            `╚════════════════════════════════════╝`,
                            ``,
                            `╭──🌟 *BOT INFO*`,
                            `│ 🤖 Bot: *${global.botname || 'M-KING'}*`,
                            `│ 📱 Number: *+${botNumber.replace('@s.whatsapp.net', '')}*`,
                            `│ 📅 Date: *${dateStr}*`,
                            `│ 🕐 Time: *${timeStr}*`,
                            `│ ⚡ Version: *v${connSettings.version}*`,
                            `╰──────────────────────────────────`,
                            ``,
                            `╭──⚡ *QUICK START*`,
                            `│ *$menu* → see all 350+ commands`,
                            `│ *$help* → commands with descriptions`,
                            `│ *$update* → check for updates`,
                            `│ *$owner* → contact bot owner`,
                            `╰──────────────────────────────────`,
                            ``,
                            `> 🤖 *M-KING Bot* is now online and ready!`,
                        ].join('\n');
                        await XeonBotInc.sendMessage(botNumber, { text: startupMsg });
                    }
                } catch (error) {
                    console.error('Error sending connection message:', error.message)
                }
            }
            await delay(1999)
            console.log(chalk.yellow(`\n\n                  ${chalk.bold.blue(`[ ${global.botname || 'M-KING'} ]`)}\n\n`))
            console.log(chalk.cyan(`< ================================================== >`))
            console.log(chalk.magenta(`\n${global.themeemoji || '•'} YT CHANNEL: M-KING`))
            console.log(chalk.magenta(`${global.themeemoji || '•'} GITHUB: m-king`))
            console.log(chalk.magenta(`${global.themeemoji || '•'} CREDIT: M-KING`))
            console.log(chalk.magenta(`${global.themeemoji || '•'} WA NUMBER: ${owner}`))
            console.log(chalk.green(`${global.themeemoji || '•'} 🤖 Bot Connected Successfully! ✅`))
            const connectedNum = XeonBotInc.user?.id?.split(':')[0] || '';
            const ownerNum     = (process.env.OWNER_NUMBER || '').replace(/\D/g, '');
            if (ownerNum && connectedNum && connectedNum !== ownerNum) {
                console.log(chalk.yellow(
                    `⚠️  NOTE: Bot is connected as +${connectedNum} but OWNER_NUMBER in $env is set to ${ownerNum}.\n` +
                    `   OWNER_NUMBER only controls which number receives the pairing code on a fresh start.\n` +
                    `   The connected account is determined by SESSION_ID. To connect a different number:\n` +
                    `   1. Remove SESSION_ID from $env\n` +
                    `   2. Set OWNER_NUMBER to the desired number\n` +
                    `   3. Restart the bot`
                ));
            }
            console.log(chalk.blue(`Bot Version: ${settings.version}`))
            console.log(chalk.cyan(`Auto-join: Enabled`))
            console.log(chalk.cyan(`Newsletter Follow: Enabled`))
        }
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode
            const isLoggedOut  = statusCode === DisconnectReason.loggedOut || statusCode === 401;
            const isBadSession = statusCode === 500;
            const shouldReconnect = !isLoggedOut;
            console.log(chalk.red(`[${sessionName}] Connection closed — statusCode=${statusCode}, reconnecting=${shouldReconnect}`))
            sessionRegistry.setOffline(sessionId, sessionName);
            if (isLoggedOut || isBadSession) {
                try {
                    rmSync(sessionDir, { recursive: true, force: true })
                    console.log(chalk.yellow(`[${sessionName}] Session files wiped (${isBadSession ? 'bad/corrupt session' : 'logged out'}).`))
                } catch (error) {
                    console.error(`[${sessionName}] Error deleting session:`, error)
                }
                if (isBadSession) {
                    console.log(chalk.yellow(`[${sessionName}] Bad session detected — restarting for fresh pairing.`))
                    global.phoneNumber = (process.env.PAIRING_NUMBER || process.env.OWNER_NUMBER || '').replace(/\D/g, '');
                    await delay(3000)
                    startSession(config)
                    return;
                }
                console.log(chalk.red(`[${sessionName}] Session logged out. Please re-authenticate.`))
            }
            if (shouldReconnect) {
                console.log(chalk.yellow(`[${sessionName}] Reconnecting...`))
                await delay(5000)
                startSession(config)
            }
        }
    })

    XeonBotInc.ev.on('call', async (calls) => {
        try {
            const { readState: readAnticallState } = require('./commands/anticall');
            const state = readAnticallState();
            if (!state.enabled) return;
            for (const call of calls) {
                const callerJid = call.from || call.peerJid || call.chatId;
                if (!callerJid) continue;
                try {
                    if (typeof XeonBotInc.rejectCall === 'function' && call.id) {
                        await XeonBotInc.rejectCall(call.id, callerJid);
                    } else if (typeof XeonBotInc.sendCallOfferAck === 'function' && call.id) {
                        await XeonBotInc.sendCallOfferAck(call.id, callerJid, 'reject');
                    }
                } catch (error) {}
            }
        } catch (error) {}
    });

    XeonBotInc.ev.on('group-participants.update', async (update) => {
        await handleGroupParticipantUpdate(XeonBotInc, update);
    });

    XeonBotInc.ev.on('status.update', async (status) => {
        await handleStatus(XeonBotInc, status);
    });

    XeonBotInc.ev.on('messages.reaction', async (status) => {
        await handleStatus(XeonBotInc, status);
    });

    return XeonBotInc
    } catch (error) {
        console.error(`[${sessionName}] Error in startSession:`, error)
        sessionRegistry.setOffline(sessionId, sessionName);
        await delay(5000)
        startSession(config)
    }
}

async function startAllSessions() {
    const sessions = [];
    for (let i = 1; i <= 10; i++) {
        const pairingKey = i === 1 ? 'PAIRING_NUMBER' : `PAIRING_NUMBER_${i}`;
        const sessionKey = i === 1 ? 'SESSION_ID' : `SESSION_ID_${i}`;
        const sessionDir = i === 1 ? 'session' : `session${i}`;
        const pairingNum = (process.env[pairingKey] || '').replace(/\D/g, '');
        const sessionIdStr = process.env[sessionKey];
        if (pairingNum || sessionIdStr) {
            sessions.push({
                id: i === 1 ? 'default' : `bot${i}`,
                name: `M-KING-${i}`,
                sessionDir: sessionDir,
                envSessionVar: sessionKey,
                enabled: true,
                ownerNumber: pairingNum,
            });
        }
    }
    if (sessions.length === 0) {
        sessions.push({
            id: 'default',
            name: process.env.NAME || settings.sessionName || global.botname || 'M-KING',
            sessionDir: 'session',
            envSessionVar: 'SESSION_ID',
            enabled: true,
            ownerNumber: '',
        });
    }
    console.log(chalk.cyan(`🤖 Starting ${sessions.length} bot session(s)…`));
    for (const cfg of sessions) {
        startSession(cfg).catch(err => {
            console.error(`[${cfg.name}] Fatal:`, err.message);
        });
        await delay(2000);
    }
}

startAllSessions().catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
})
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err)
})
process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err)
})
