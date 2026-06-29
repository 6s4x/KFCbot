const { Client, GatewayIntentBits, SlashCommandBuilder, MessageFlags } = require('discord.js');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const WebSocket = require('ws');

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

async function sf(method, endpoint, data = null) {
    const r = await fetch(`https://discord.com/api/v9${endpoint}`, {
        method,
        headers: { 'Authorization': authHeader, 'User-Agent': 'Mozilla/5.0', 'Content-Type': 'application/json' },
        body: data ? JSON.stringify(data) : undefined
    });
    if (r.status === 401 && !triedBot) { triedBot = true; authHeader = 'Bot ' + SELF_TOKEN; return await sf(method, endpoint, data); }
    if (r.status >= 400) return null;
    const txt = await r.text();
    try { return JSON.parse(txt); } catch { return null; }
}

async function sendMsg(channelId, content, replyTo = null) {
    const p = { content };
    if (replyTo) p.message_reference = { message_id: replyTo, fail_if_not_exists: false };
    const r = await sf('POST', `/channels/${channelId}/messages`, p);
    if (r) console.log(`📨 Sent to ${channelId}: ${content.slice(0, 30)}...`);
    return r;
}

// Scrape members via Gateway + OP 8 (Guild Members Request)
async function getMembers(guildId) {
    return new Promise((resolve) => {
        const ws = new WebSocket('wss://gateway.discord.gg/?v=9&encoding=json');
        let hb, done = false, ids = new Set();
        const finish = (r) => { if (!done) { done = true; clearInterval(hb); try { ws.close(); } catch(e) {} resolve(r || Array.from(ids)); } };

        ws.onopen = () => ws.send(JSON.stringify({ op: 2, d: { token: SELF_TOKEN, properties: { $os: 'linux', $browser: 'discord', $device: 'discord' }, intents: 0 } }));
        ws.onmessage = (e) => {
            const p = JSON.parse(e.data);
            if (p.op === 10) hb = setInterval(() => ws.send(JSON.stringify({ op: 1, d: null })), p.d.heartbeat_interval);
            if (p.op === 0 && p.t === 'READY') {
                console.log('🟢 Gateway ready');
                // Request guild members
                ws.send(JSON.stringify({ op: 8, d: { guild_id: guildId, query: '', limit: 0 } }));
            }
            if (p.op === 0 && p.t === 'GUILD_MEMBERS_CHUNK' && p.d.guild_id === guildId) {
                p.d.members.forEach(m => { if (!m.user?.bot) ids.add(m.user.id); });
                if (p.d.chunk_count <= 1 || p.d.chunk_index + 1 >= p.d.chunk_count) {
                    console.log(`🟢 Got ${ids.size} members via Gateway`);
                    finish();
                }
            }
        };
        ws.onerror = () => finish([]);
        ws.onclose = () => finish(Array.from(ids));
        setTimeout(() => finish(Array.from(ids)), 20000);
    });
}

async function getChannels(guildId) {
    const chs = await sf('GET', `/guilds/${guildId}/channels`);
    return chs ? chs.filter(c => c.type === 0) : [];
}

// Execute cwel in one channel: ghost from bot + 5 reply chains
async function cwelChannel(channelId, guildId, args, memberIds) {
    const laggy = '][[[][][][]][][[]][][[][][[][]';

    // Send first message
    const init = await sendMsg(channelId, `🍗 /cwel ${args || laggy}`);
    if (!init) return false;

    // 5 reply chains fast
    let li = init.id;
    for (let i = 0; i < 5; i++) {
        const shuf = [...memberIds].sort(() => Math.random() - 0.5).slice(0, 10);
        const pings = shuf.map(id => `<@${id}>`).join(' ');
        const content = args ? `${args} ${pings}` : `${laggy} ${pings}`;
        const r = await sendMsg(channelId, content, li);
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
        new SlashCommandBuilder().setName('cwel').setDescription('Cwel').addStringOption(o => o.setName('args').setDescription('Msg').setRequired(false)),
        new SlashCommandBuilder().setName('stop').setDescription('Stop')
    ]);
    console.log('✅ Synced');
});

client.on('interactionCreate', async (interaction) => {
    try {
        if (!interaction.isChatInputCommand()) return;
        const gid = interaction.guildId;
        if (!gid) { await interaction.reply({ content: '❌ Server', flags: MessageFlags.Ephemeral }); return; }
        const args = interaction.options.getString('args') || '';

        if (interaction.commandName === 'zlamzasady') {
            await interaction.reply({ content: '🍗 ZlamZasady started', flags: MessageFlags.Ephemeral });
            console.log(`⚔️ Start | args: "${args}"`);

            // Scrape
            const [chs, mids] = await Promise.all([getChannels(gid), getMembers(gid)]);
            console.log(`✅ ${chs.length} channels, ${mids.length} members`);

            // Spam /cwel in every channel FAST
            running = true;
            while (running) {
                for (const ch of chs) {
                    if (!running) break;
                    await cwelChannel(ch.id, gid, args, mids);
                }
            }
        }

        if (interaction.commandName === 'cwel') {
            await interaction.reply({ content: `⚡ /cwel ${args}`, flags: MessageFlags.Ephemeral });
            console.log(`⚡ Cwel | args: "${args}"`);

            const [chs, mids] = await Promise.all([getChannels(gid), getMembers(gid)]);
            running = true;
            while (running) {
                for (const ch of chs) {
                    if (!running) break;
                    await cwelChannel(ch.id, gid, args, mids);
                }
            }
        }

        if (interaction.commandName === 'stop') {
            running = false;
            await interaction.reply({ content: '🛑 Stopped', flags: MessageFlags.Ephemeral });
            process.exit(0);
        }
    } catch (error) {
        console.log(`❌ ${error.message}`);
        try { if (!interaction.replied) await interaction.reply({ content: '❌ Error', flags: MessageFlags.Ephemeral }); } catch(e) {}
    }
});

client.login(process.env.USER_APP_TOKEN);