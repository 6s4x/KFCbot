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
let cwelCmdId = null, appId = null;
let gatewaySessionId = null, memberIds = [], channels = [];

async function sf(method, endpoint, data = null) {
    const r = await fetch(`https://discord.com/api/v9${endpoint}`, {
        method,
        headers: { 'Authorization': authHeader, 'User-Agent': 'Mozilla/5.0', 'Content-Type': 'application/json' },
        body: data ? JSON.stringify(data) : undefined
    });
    if (r.status === 401 && !triedBot) { triedBot = true; authHeader = 'Bot ' + SELF_TOKEN; return await sf(method, endpoint, data); }
    const txt = await r.text();
    if (r.status >= 400) return null;
    try { return JSON.parse(txt); } catch { return null; }
}

// Gateway connection - returns session_id
function connectGateway(guildId) {
    return new Promise((resolve) => {
        const ws = new WebSocket('wss://gateway.discord.gg/?v=9&encoding=json');
        let hb;

        ws.onopen = () => ws.send(JSON.stringify({ op: 2, d: { token: SELF_TOKEN, properties: { $os: 'linux', $browser: 'discord', $device: 'discord' }, intents: 0 } }));

        ws.onmessage = (e) => {
            const p = JSON.parse(e.data);
            if (p.op === 10) hb = setInterval(() => ws.send(JSON.stringify({ op: 1, d: null })), p.d.heartbeat_interval);

            if (p.op === 0 && p.t === 'READY') {
                gatewaySessionId = p.d.session_id;
                console.log(`🟢 Gateway session: ${gatewaySessionId}`);
                // Request members
                ws.send(JSON.stringify({ op: 8, d: { guild_id: guildId, query: '', limit: 0 } }));
            }

            if (p.op === 0 && p.t === 'GUILD_MEMBERS_CHUNK' && p.d.guild_id === guildId) {
                p.d.members.forEach(m => { if (!m.user?.bot) memberIds.push(m.user.id); });
                if (!p.d.chunk_count || p.d.chunk_index + 1 >= p.d.chunk_count) {
                    console.log(`✅ Members: ${memberIds.length}`);
                    resolve(gatewaySessionId);
                }
            }
        };

        ws.onclose = () => { clearInterval(hb); if (!gatewaySessionId) resolve(null); };
        ws.onerror = () => { if (!gatewaySessionId) resolve(null); };
        setTimeout(() => resolve(gatewaySessionId), 30000);
    });
}

// Trigger /cwel via Discord API
async function triggerCwel(channelId, guildId, args) {
    if (!cwelCmdId || !gatewaySessionId) return false;
    const nonce = Date.now().toString() + Math.random().toString(36).slice(2, 8);
    const payload = {
        type: 2, application_id: appId, guild_id: guildId,
        channel_id: channelId, session_id: gatewaySessionId,
        data: { id: cwelCmdId, name: 'cwel', type: 1, options: args ? [{ name: 'args', value: args, type: 3 }] : [] },
        nonce
    };
    const r = await fetch('https://discord.com/api/v9/interactions', {
        method: 'POST',
        headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (r.ok) { console.log(`🎯 /cwel in ch ${channelId}`); return true; }
    else { console.log(`❌ Trigger failed: ${r.status}`); return false; }
}

// Handle /cwel: ghost + 5 bot reply chains via webhook
async function handleCwel(interaction, args) {
    const laggy = '][[[][][][]][][[]][][[][][[][]';
    await interaction.reply({ content: `⚡ /cwel`, flags: MessageFlags.Ephemeral });
    const wh = `https://discord.com/api/v9/webhooks/${appId}/${interaction.token}`;
    let lastId = null;
    for (let i = 0; i < 5; i++) {
        const shuf = [...memberIds].sort(() => Math.random() - 0.5).slice(0, 10);
        const pings = shuf.map(id => `<@${id}>`).join(' ');
        const content = args ? `${args} ${pings}` : `${laggy} ${pings}`;
        const payload = { content, flags: 0 };
        if (lastId) payload.message_reference = { message_id: lastId, fail_if_not_exists: false };
        const r = await fetch(wh + '?wait=true', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        if (r.ok) { const d = await r.json(); lastId = d.id; console.log(`📨 Bot ${i+1}/5`); }
    }
}

client.once('ready', () => {
    console.log(`🔧 Bot: ${client.user.tag}`);
    console.log(KFC_LOGO);
    appId = client.user.id;
});

client.on('ready', async () => {
    const cmds = await client.application.commands.set([
        new SlashCommandBuilder().setName('zlamzasady').setDescription('KFC').addStringOption(o => o.setName('args').setDescription('Args').setRequired(false)),
        new SlashCommandBuilder().setName('cwel').setDescription('Cwel').addStringOption(o => o.setName('args').setDescription('Msg').setRequired(false)),
        new SlashCommandBuilder().setName('stop').setDescription('Stop')
    ]);
    cwelCmdId = cmds.find(c => c.name === 'cwel')?.id;
    console.log(`✅ Synced | /cwel ID: ${cwelCmdId}`);
});

client.on('interactionCreate', async (interaction) => {
    try {
        if (!interaction.isChatInputCommand()) return;
        const gid = interaction.guildId;
        if (!gid) { await interaction.reply({ content: '❌ Server', flags: MessageFlags.Ephemeral }); return; }
        const args = interaction.options.getString('args') || '';

        if (interaction.commandName === 'zlamzasady') {
            await interaction.reply({ content: '🍗 Start', flags: MessageFlags.Ephemeral });
            console.log(`⚔️ Start | args: "${args}"`);

            // Get channels
            const chs = await sf('GET', `/guilds/${gid}/channels`);
            channels = chs ? chs.filter(c => c.type === 0) : [];
            console.log(`✅ ${channels.length} channels`);

            // Connect Gateway & wait for session + members
            console.log('🔄 Connecting Gateway...');
            const sid = await connectGateway(gid);
            if (!sid) { console.log('❌ Gateway failed'); return; }
            console.log(`🟢 Ready | ${memberIds.length} members`);

            // Loop: spam /cwel in every channel
            running = true;
            while (running) {
                for (const ch of channels) {
                    if (!running) break;
                    await triggerCwel(ch.id, gid, args);
                    await new Promise(r => setTimeout(r, 300));
                }
            }
        }

        if (interaction.commandName === 'cwel') {
            console.log(`⚡ Cwel | args: "${args}"`);
            await handleCwel(interaction, args);
        }

        if (interaction.commandName === 'stop') {
            running = false;
            await interaction.reply({ content: '🛑 Stop', flags: MessageFlags.Ephemeral });
            process.exit(0);
        }
    } catch (error) {
        console.log(`❌ ${error.message}`);
        try { if (!interaction.replied) await interaction.reply({ content: '❌ Error', flags: MessageFlags.Ephemeral }); } catch(e) {}
    }
});

client.login(process.env.USER_APP_TOKEN);