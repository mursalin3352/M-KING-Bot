const fs = require('fs');
const path = require('path');

const COMMAND_EMOJIS = {
    '$ai': '🤖', '$ask': '🤖', '$gpt4o': '🤖', '$gptlarge': '🤖', '$gptfast': '🤖', '$gpt': '🤖', '$gemini': '🤖', '$mistral': '🤖', '$qwen': '🤖',
    '$imagine': '🎨', '$flux': '🎨', '$txt2img': '🎨', '$sora': '🎨',
    '$play': '🎵', '$song': '🎵', '$ytmp4': '📹', '$video': '📹', '$tiktok': '📥', '$tt': '📥', '$instagram': '📥', '$facebook': '📥', '$spotify': '🎵', '$apk': '📦', '$gitclone': '📦',
    '$apimovie': '🎬', '$moviesub': '📜', '$movietrailer': '🎬', '$movie': '🎬', '$animeinfo': '🎌', '$anime': '🎬', '$net9ja': '🎬', '$trending': '🎬', '$upcoming': '🎬', '$schedule': '🎬', '$livesearch': '📺', '$livestream': '📺', '$live': '📺',
    '$manga': '📚',
    '$kick': '🛡️', '$promote': '🛡️', '$demote': '🛡️', '$unmute': '🛡️', '$mute': '🛡️', '$unban': '🛡️', '$ban': '🛡️', '$clearwarn': '🛡️', '$warnings': '🛡️', '$warn': '🛡️', '$antibadword': '🛡️', '$antilink': '🛡️', '$antitag': '🛡️', '$hidetag': '🛡️', '$tagall': '🛡️', '$tag': '🛡️', '$listadmins': '🛡️', '$listonline': '🛡️', '$membercount': '🛡️', '$groupinfo': '🛡️', '$grouplink': '🛡️', '$resetlink': '🛡️', '$topmembers': '🛡️', '$welcome': '🛡️', '$goodbye': '🛡️', '$pin': '📌', '$unpin': '📌',
    '$soccerstandings': '🏆', '$nbastandings': '🏆', '$nflstandings': '🏆', '$sportsteam': '🏆', '$sportsplayer': '🏆', '$livescores': '🏆', '$scoreboard': '🏆', '$sports': '🏆', '$flivescore': '⚽', '$fls': '⚽', '$fstream': '📡', '$fstreaming': '📡', '$fplayer': '👤', '$fteam': '🏟️', '$fvenue': '🏟️', '$fnews': '📰', '$footballnews': '📰', '$fleagues': '🏆', '$eplstand': '🏆', '$eplmatches': '📅', '$eplupcoming': '📅', '$eplfixtures': '📅', '$laligastand': '🏆', '$laligamatches': '📅', '$laligaupcoming': '📅', '$laligafixtures': '📅', '$bundesstand': '🏆', '$bundesliga': '🏆', '$blive': '🏀', '$bball': '🏀', '$charquote': '💬', '$showquote': '💬',
    '$ephoto': '🎨', '$ephoto2': '🎨', '$ephotolist': '🎨',
    '$tinyurl': '🔗', '$cleanuri': '🔗', '$vgd': '🔗', '$rebrandly': '🔗', '$vurl': '🔗', '$adfoc': '🔗', '$ssur': '🔗',
    '$cryptotrand': '💰', '$cryptoconv': '💰', '$cryptotop': '💰', '$crypto': '💰',
    '$get': '🌐', '$fetch': '🌐', '$api': '🌐', '$weather': '🌤️', '$translate': '🌐', '$tts': '🔊', '$ss': '📸', '$createqr': '📱', '$carbon': '💻', '$imgscan': '🔍', '$removebg': '✂️', '$remini': '✨', '$netinfo': '🌐', '$url': '🔗', '$tempmail': '📧', '$vcf': '📇',
    '$funjokes': '😂', '$joke': '😂', '$dare': '🎯', '$truth': '🎯', '$rizz': '😏', '$meme': '🐸', '$waifu': '🌸', '$eightball': '🎱', '$trivia': '🧠', '$hangman': '🎮', '$tictactoe': '🎮', '$ship': '💕', '$simp': '🥺', '$wasted': '💀', '$roast': '🔥', '$insult': '🔥', '$compliment': '🌹', '$flirt': '😍', '$advice': '💡', '$quote': '📖',
    '$stickertelegram': '🖼️', '$stickercrop': '🖼️', '$sticker': '🖼️', '$attp': '✍️', '$emojimix': '🎨',
    '$ytsearch': '🔍', '$yts': '🔍', '$wallpaper': '🖼️', '$pinterest': '🖼️', '$lyrics': '🎵', '$slyrics': '🎵', '$news': '📰', '$gsearch': '🔍', '$gimage': '🖼️', '$ttsearch': '🎵', '$chord': '🎸', '$hearthis': '🎧', '$scsearch': '☁️', '$npmpkg': '📦', '$happymod': '📱', '$wattpad': '📖', '$stickersearch': '🎭',
    '$ttstalk': '👀', '$ghstalk': '👀', '$igstalk': '👀', '$twstalk': '👀', '$steamstalk': '👀',
    '$textpro': '✨', '$codeai': '💻', '$phone': '📱', '$lid': '🔑', '$jid': '📟', '$jidp': '✅', '$tempphone': '📞', '$smsinbox': '📬', '$bible': '✝️',
    '$autoupdate': '🔄', '$update': '🔄', '$menu': '📋', '$help': '📋', '$ping': '🏓', '$alive': '💚', '$uptime': '⏱️', '$owner': '👤', '$settings': '⚙️', '$calc': '🧮', '$pair': '🔐', '$unpair': '🔌',
    '$autotyping': '⌨️', '$autoread': '👁️', '$autostatus': '🔁', '$autoreact': '⚡', '$areact': '⚡', '$anticall': '🚫', '$pmblocker': '🚫', '$mode': '🔧', '$block': '🚫', '$unblock': '✅', '$bc': '📢', '$clearsession': '🗑️', '$cleartmp': '🗑️', '$savestatus': '💾', '$afk': '😴', '$antidelete': '🔒', '$setpp': '🖼️',
};

const USER_GROUP_DATA = path.join(__dirname, '../data/userGroupData.json');

function getData(){ try{ return JSON.parse(fs.readFileSync(USER_GROUP_DATA,'utf8')); }catch{ return {}; } }
function saveData(d){ fs.writeFileSync(USER_GROUP_DATA, JSON.stringify(d,null,2)); }

function getCard(enabled, emojis){
  const status = enabled ? '✅ Enabled' : '❌ Disabled';
  let emojiText = (emojis && emojis.length) ? emojis.join(' ') : (enabled ? '❤️' : 'Not set');
  return `*⚡ AUTO REACTION*\n\nStatus: ${status}\nEmojis: ${emojiText}\n\nUse:\n$areact on\n$areact off\n$areact set 🌚 😂 🔥`;
}

function getEmojiForCommand(userMessage){
  if(!userMessage) return null;
  const lower = userMessage.toLowerCase().trim();
  const sorted = Object.keys(COMMAND_EMOJIS).sort((a,b)=>b.length-a.length);
  for(const prefix of sorted){
    if(lower===prefix || lower.startsWith(prefix+' ')) return COMMAND_EMOJIS[prefix];
  }
  return null;
}

async function handleAreactCommand(sock, chatId, message, isOwner){
  if(!isOwner) return;
  const fullText = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
  const sub = (fullText.trim().split(/\s+/)[1] || '').toLowerCase();
  let data = getData();
  if(!data.autoReactionChats) data.autoReactionChats = {};
  if(!data.autoReactionChats[chatId]) data.autoReactionChats[chatId] = { enabled:false, emojis:["❤️"] };
  let cur = data.autoReactionChats[chatId];
  if(data.autoReaction !== undefined) delete data.autoReaction;

  if(sub==='on'){ cur.enabled=true; saveData(data); await sock.sendMessage(chatId,{text:getCard(true,cur.emojis)},{quoted:message}); }
  else if(sub==='off'){ cur.enabled=false; saveData(data); await sock.sendMessage(chatId,{text:getCard(false,cur.emojis)},{quoted:message}); }
  else if(sub==='set'){ let part=fullText.substring(fullText.toLowerCase().indexOf('set')+3).trim(); let emojis=part.split(/[\s,]+/).filter(e=>e); if(!emojis.length) emojis=["❤️"]; cur.emojis=emojis; cur.enabled=true; saveData(data); await sock.sendMessage(chatId,{text:getCard(true,cur.emojis)},{quoted:message}); }
  else{ await sock.sendMessage(chatId,{text:getCard(cur.enabled,cur.emojis)},{quoted:message}); }
}

async function addCommandReaction(sock, message, userMessage){
  try{
    if(!message?.key?.id || message.key.fromMe) return;
    const chatId = message.key.remoteJid;
    let data = getData();
    if(data.autoReactionChats && data.autoReactionChats[chatId] && data.autoReactionChats[chatId].enabled){
      const cfg = data.autoReactionChats[chatId];
      const emojis = cfg.emojis && cfg.emojis.length ? cfg.emojis : ["❤️"];
      const r = emojis[Math.floor(Math.random()*emojis.length)];
      await sock.sendMessage(chatId,{react:{text:r,key:message.key}});
      return;
    }
    if(data.autoReactionChats && data.autoReactionChats[chatId] && !data.autoReactionChats[chatId].enabled) return;
    const cmd = getEmojiForCommand(userMessage);
    if(cmd) await sock.sendMessage(chatId,{react:{text:cmd,key:message.key}});
  }catch(e){ console.log('react error:', e.message); }
}

module.exports = { addCommandReaction, handleAreactCommand, getEmojiForCommand };
