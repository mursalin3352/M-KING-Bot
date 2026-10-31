'use strict';
const axios = require('axios');

async function fetchImgBuf(url) {
    const res = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 15000,
    });
    return Buffer.from(res.data);
}

async function catfactCommand(sock, chatId, message) {
    try {
        const { data } = await axios.get('https://catfact.ninja/fact');
        await sock.sendMessage(chatId, { text: `🐱 *CAT FACT*\n\n${data.fact}\n\n_M-KING_ ⚡` }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Could not fetch cat fact.' }, { quoted: message });
    }
}

async function catimageCommand(sock, chatId, message) {
    try {
        // TheCatAPI - sab se stable hai
        const { data } = await axios.get('https://api.thecatapi.com/v1/images/search');
        const imgBuf = await fetchImgBuf(data[0].url);
        await sock.sendMessage(chatId, { image: imgBuf, caption: `🐱 *RANDOM CAT* 🐱\n\n_M-KING_ ⚡` }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Could not fetch cat image.' }, { quoted: message });
    }
}

async function dogfactCommand(sock, chatId, message) {
    try {
        // Kinduff Dog API - SRA se behtar
        const { data } = await axios.get('https://dog-api.kinduff.com/api/facts');
        await sock.sendMessage(chatId, { text: `🐶 *DOG FACT*\n\n${data.facts[0]}\n\n_M-KING_ ⚡` }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Could not fetch dog fact.' }, { quoted: message });
    }
}

async function dogimageCommand(sock, chatId, message) {
    try {
        const { data } = await axios.get('https://dog.ceo/api/breeds/image/random');
        const imgBuf = await fetchImgBuf(data.message);
        await sock.sendMessage(chatId, { image: imgBuf, caption: `🐶 *RANDOM DOG* 🐶\n\n_M-KING_ ⚡` }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Could not fetch dog image.' }, { quoted: message });
    }
}

async function foxImageCommand(sock, chatId, message) {
    try {
        const { data } = await axios.get('https://randomfox.ca/floof/');
        const imgBuf = await fetchImgBuf(data.image);
        await sock.sendMessage(chatId, { image: imgBuf, caption: `🦊 *RANDOM FOX*\n\n_M-KING_ ⚡` }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Could not fetch fox image.' }, { quoted: message });
    }
}

async function pandaImageCommand(sock, chatId, message) {
    try {
        const { data } = await axios.get('https://some-random-api.com/animal/panda'); // fallback bhi chalega
        const imgBuf = await fetchImgBuf(data.image);
        await sock.sendMessage(chatId, { image: imgBuf, caption: `🐼 *PANDA*\n\n_M-KING_ ⚡` }, { quoted: message });
    } catch {
        const { data } = await axios.get('https://api.thecatapi.com/v1/images/search?tags=panda'); // backup
        const imgBuf = await fetchImgBuf(data[0].url);
        await sock.sendMessage(chatId, { image: imgBuf, caption: `🐼 *PANDA*\n\n_M-KING_ ⚡` }, { quoted: message });
    }
}

async function koalaImageCommand(sock, chatId, message) {
    try {
        const { data } = await axios.get('https://some-random-api.com/animal/koala');
        const imgBuf = await fetchImgBuf(data.image);
        await sock.sendMessage(chatId, { image: imgBuf, caption: `🐨 *KOALA*\n\n_M-KING_ ⚡` }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Could not fetch koala image.' }, { quoted: message });
    }
}

async function birbCommand(sock, chatId, message) {
    try {
        const { data } = await axios.get('https://shibe.online/api/birds?count=1');
        const imgBuf = await fetchImgBuf(data[0]);
        await sock.sendMessage(chatId, { image: imgBuf, caption: `🐦 *RANDOM BIRD*\n\n_M-KING_ ⚡` }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Could not fetch bird image.' }, { quoted: message });
    }
}

async function raccoonCommand(sock, chatId, message) {
    try {
        const { data } = await axios.get('https://some-random-api.com/animal/raccoon');
        const imgBuf = await fetchImgBuf(data.image);
        await sock.sendMessage(chatId, { image: imgBuf, caption: `🦝 *RACCOON*\n\n_M-KING_ ⚡` }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Could not fetch raccoon image.' }, { quoted: message });
    }
}

module.exports = {
    catfactCommand, catimageCommand,
    dogfactCommand, dogimageCommand,
    foxImageCommand, pandaImageCommand,
    koalaImageCommand, birbCommand, raccoonCommand,
};
