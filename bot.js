const { Client, GatewayIntentBits, SlashCommandBuilder, MessageFlags } = require('discord.js');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const KFC_LOGO = `██╗   ██╗   ███████╗     ██████╗ 
██║  ██╔╝ ██╔════╝  ██╔════╝ 
█████╔╝  █████╗        ██║      
██╔═██╗  ██╔══╝        ██║      
██║   ██╗  ██║                ╚██████╗ 
╚═╝   ╚═╝  ╚═╝                   ╚═════╝`;

let running = false;
const SELF_TOKEN = (process.env.SELFBOT_TOKEN || '').trim();
let authHeader = SELF_TOKEN;
let triedBot = false;
let cachedMemberIds = [];
let cachedChannels = [];

// Selfbot REST API calls
async function discordFetch(method, endpoint, data = null) {
    const r = await fetch(`https://discord.com/api/v9${endpoint}`, {
        method,
        headers: {
            'Authorization': authHeader,
            'User-Agent': 'Mozilla/5.0',
            'Content-Type': 'application/json'
        },
        body: data ? JSON.stringify(data) : undefined
    });
    if (r.status === 401 && !triedBot) {
        triedBot = true;
        authHeader = 'Bot ' + SELF_TOKEN;
        return await discordFetch(method, endpoint, data);
    }
    if (r.status >= 400) return null;
    const txt = await r.text();
    try { return JSON.parse(txt); } catch { return null; }
}

async function sendMsg(channelId, content, replyToId = null) {
    const p = { content };
    if (replyToId) p.message_reference = { message_id: replyToId, fail_if_not_exists: false };
    return await discordFetch('POST', `/channels/${channelId}/messages`, p);
}

// Scrape members via WebSocket Gateway (only way for user tokens)
const WebSocket = require('ws');
async function scrapeMembers(guildId) {
    return new Promise((resolve) => {
        const ws = new WebSocket('wss://gateway.discord.gg/?v=9&encoding=json');
        let hb = null;
        const ids = new Set();
        let resolved = false;

        const done = (result) => {
            if (resolved) return;
            resolved = true;
            if (hb) clearInterval(hb);
            try { ws.close(); } catch(e) {}
            resolve(result);
        };

        ws.onopen = () => {
            ws.send(JSON.stringify({ op: 2, d: {
                token: SELF_TOKEN,
                properties: { $os: 'linux', $browser: 'discord', $device: 'discord' },
                intents: 0
            }}));
        };

        ws.onmessage = (e) => {
            const p = JSON.parse(e.data);
            if (p.op === 10) hb = setInterval(() => ws.send(JSON.stringify({ op: 1, d: null })), p.d.heartbeat_interval);
            if (p.op === 0 && p.t === 'GUILD_CREATE' && p.d.id === guildId && p.d.members) {
                p.d.members.forEach(m => { if (!m.user.bot) ids.add(m.user.id); });
                console.log(`🟢 Gateway: ${ids.size} members`);
                done(Array.from(ids));
            }
            if (p.op === 0 && p.t === 'READY') console.log('🟢 Gateway connected');
        };

        ws.onerror = () => done([]);
        ws.onclose = () => done(Array.from(ids));
        setTimeout(() => done(Array.from(ids)), 15000);
    });
}

// Scrape channels via REST
async function scrapeChannels(guildId) {
    const chs = await discordFetch('GET', `/guilds/${guildId}/channels`);
    if (!chs) return [];
    return chs.filter(c => c.type === 0);
}

// Do ONE cwel cycle
async function doCwel(guildId, args) {
    const tc = cachedChannels.length > 0 ? cachedChannels : await scrapeChannels(guildId);
    const mids = cachedMemberIds.length > 0 ? cachedMemberIds : await scrapeMembers(guildId);
    const laggy = '][[[][][][]][][[]][][[][][[][]';

    if (tc.length === 0) return false;

    // Send first message
    const init = await sendMsg(tc[0].id, `🍗 ${args || laggy}`);
    if (!init) return false;

    // Send 5 reply chains FAST
    let li = init.id;
    for (let i = 0; i < 5; i++) {
        const shuf = [...mids].sort(() => Math.random() - 0.5).slice(0, 10);
        const pings = shuf.map(id => `<@${id}>`).join(' ');
        const content = args ? `${args} ${pings}` : `${laggy} ${pings}`;
        const ch = tc[i % tc.length];
        const r = await sendMsg(ch.id, content, li);
        if (r) li = r.id;
    }
    return true;
}

client.once('ready', () => {
    console.log(`🔧 Bot: ${client.user.tag}`);
    console.log(KFC_LOGO);
});

client.on('ready', async () => {
    await client.application.commands.set([
        new SlashCommandBuilder().setName('zlamzasady').setDescription('KFC bot').addStringOption(o => o.setName('args').setDescription('Args').setRequired(false)),
        new SlashCommandBuilder().setName('cwel').setDescription('Cwel cmd').addStringOption(o => o.setName('args').setDescription('Msg').setRequired(false)),
        new SlashCommandBuilder().setName('stop').setDescription('Stop')
    ]);
    console.log('✅ Commands synced');
});

client.on('interactionCreate', async (interaction) => {
    try {
        if (!interaction.isChatInputCommand()) return;
        const gid = interaction.guildId;
        if (!gid) { await interaction.reply({ content: '❌ Server only', flags: MessageFlags.Ephemeral }); return; }
        const args = interaction.options.getString('args') || '';

        if (interaction.commandName === 'zlamzasady') {
            await interaction.reply({ content: '🍗 Go', flags: MessageFlags.Ephemeral });
            console.log(`⚔️ Start | args: "${args}"`);

            // Pre-scrape channels and members once
            cachedChannels = await scrapeChannels(gid);
            cachedMemberIds = await scrapeMembers(gid);
            console.log(`✅ ${cachedChannels.length} channels, ${cachedMemberIds.length} members`);

            // SPAM FAST
            running = true;
            while (running) {
                await doCwel(gid, args);
            }
        }

        if (interaction.commandName === 'cwel') {
            await interaction.reply({ content: '⚡ Cwel', flags: MessageFlags.Ephemeral });
            console.log(`⚡ Cwel | args: "${args}"`);

            cachedChannels = await scrapeChannels(gid);
            cachedMemberIds = await scrapeMembers(gid);
            running = true;
            while (running) {
                await doCwel(gid, args);
            }
        }

        if (interaction.commandName === 'stop') {
            running = false;
            cachedMemberIds = [];
            cachedChannels = [];
            await interaction.reply({ content: '🛑 Stop', flags: MessageFlags.Ephemeral });
            process.exit(0);
        }
    } catch (error) {
        console.log(`❌ ${error.message}`);
        try { if (!interaction.replied) await interaction.reply({ content: '❌ Error', flags: MessageFlags.Ephemeral }); } catch(e) {}
    }
});

client.login(process.env.USER_APP_TOKEN);