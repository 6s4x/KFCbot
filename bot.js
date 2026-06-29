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
let cwelCmdId = null, cwelVersion = null, appId = null;
let gatewaySessionId = null, memberIds = [], channels = [];

async function sf(method, endpoint, data = null, useBot = false) {
    const r = await fetch(`https://discord.com/api/v9${endpoint}`, {
        method,
        headers: { 'Authorization': useBot ? 'Bot ' + process.env.USER_APP_TOKEN : SELF_TOKEN, 'User-Agent': 'Mozilla/5.0', 'Content-Type': 'application/json' },
        body: data ? JSON.stringify(data) : undefined
    });
    const txt = await r.text();
    if (r.status >= 400) return null;
    try { return JSON.parse(txt); } catch { return null; }
}

function connectGateway(guildId) {
    return new Promise((resolve) => {
        const ws = new WebSocket('wss://gateway.discord.gg/?v=9&encoding=json');
        let hb;
        ws.onopen = () => ws.send(JSON.stringify({ op: 2, d: { token: SELF_TOKEN, properties: { $os: 'linux', $browser: 'chrome', $device: 'pc' }, intents: 0 } }));
        ws.onmessage = (e) => {
            const p = JSON.parse(e.data);
            if (p.op === 10) hb = setInterval(() => ws.send(JSON.stringify({ op: 1, d: null })), p.d.heartbeat_interval);
            if (p.op === 0 && p.t === 'READY') {
                gatewaySessionId = p.d.session_id;
                ws.send(JSON.stringify({ op: 8, d: { guild_id: guildId, query: '', limit: 0 } }));
            }
            if (p.op === 0 && p.t === 'GUILD_MEMBERS_CHUNK' && p.d.guild_id === guildId) {
                p.d.members.forEach(m => { if (!m.user?.bot) memberIds.push(m.user.id); });
                if (!p.d.chunk_count || p.d.chunk_index + 1 >= p.d.chunk_count) {
                    console.log(`✅ Members: ${memberIds.length}`);
                }
            }
        };
        ws.onclose = () => { clearInterval(hb); resolve(gatewaySessionId); };
        ws.onerror = () => resolve(gatewaySessionId);
        setTimeout(() => resolve(gatewaySessionId), 8000);
    });
}

async function triggerCwel(channelId, guildId, args) {
    if (!cwelCmdId || !gatewaySessionId || !cwelVersion) return { ok: false, retry: 0 };
    const nonce = Date.now().toString() + Math.random().toString(36).slice(2, 8);
    const payload = {
        type: 2, application_id: appId, guild_id: guildId,
        channel_id: channelId, session_id: gatewaySessionId,
        data: { id: cwelCmdId, name: 'cwel', type: 1, version: cwelVersion, options: args ? [{ name: 'args', value: args, type: 3 }] : [] },
        nonce
    };
    const r = await fetch('https://discord.com/api/v9/interactions', {
        method: 'POST',
        headers: { 'Authorization': SELF_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (r.ok) return { ok: true, retry: 0 };
    if (r.status === 429) {
        const body = await r.json();
        return { ok: false, retry: (body.retry_after || 1) * 1000 };
    }
    return { ok: false, retry: 500 };
}

async function handleCwel(interaction, args) {
    const laggy = '][[[][][][]][][[]][][[][][[][]';
    await interaction.reply({ content: `⚡ /cwel`, flags: MessageFlags.Ephemeral });
    const wh = `https://discord.com/api/v9/webhooks/${appId}/${interaction.token}`;
    let lastId = null;
    for (let i = 0; i < 5; i++) {
        const shuf = [...memberIds].sort(() => Math.random() - 0.5).slice(0, 10);
        const pings = shuf.map(id => `<@${id}>`).join(' ');
        const content = args ? `${args} ${pings}` : `${laggy} ${pings}`;
        const payload = { content };
        if (lastId) payload.message_reference = { message_id: lastId, fail_if_not_exists: false };
        const r = await fetch(wh + '?wait=true', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        if (r.ok) { const d = await r.json(); lastId = d.id; console.log(`📨 Bot ${i+1}/5`); }
        else if (r.status === 429) { const body = await r.json(); await new Promise(r2 => setTimeout(r2, (body.retry_after || 1) * 1000)); i--; }
        else console.log(`❌ Webhook ${i+1} ${r.status}`);
    }
}

client.once('ready', () => {
    console.log(`🔧 Bot: ${client.user.tag}`);
    appId = client.user.id;
});

client.on('ready', async () => {
    const cmds = await client.application.commands.set([
        new SlashCommandBuilder().setName('zlamzasady').setDescription('KFC').addStringOption(o => o.setName('args').setDescription('Args').setRequired(false)),
        new SlashCommandBuilder().setName('cwel').setDescription('Cwel').addStringOption(o => o.setName('args').setDescription('Msg').setRequired(false)),
        new SlashCommandBuilder().setName('stop').setDescription('Stop')
    ]);
    const cwel = cmds.find(c => c.name === 'cwel');
    cwelCmdId = cwel.id; cwelVersion = cwel.version;
    console.log(`✅ Synced | /cwel ID: ${cwelCmdId} | v: ${cwelVersion}`);
});

client.on('interactionCreate', async (interaction) => {
    try {
        if (!interaction.isChatInputCommand()) return;
        const gid = interaction.guildId;
        if (!gid) { await interaction.reply({ content: '❌', flags: MessageFlags.Ephemeral }); return; }
        const args = interaction.options.getString('args') || '';

        if (interaction.commandName === 'zlamzasady') {
            await interaction.reply({ content: '🍗 Start', flags: MessageFlags.Ephemeral });
            console.log(`⚔️ Start | args: "${args}"`);

            const chs = await sf('GET', `/guilds/${gid}/channels`);
            channels = chs ? chs.filter(c => c.type === 0) : [];
            console.log(`✅ ${channels.length} channels`);

            await connectGateway(gid);
            console.log(`🟢 Session: ${gatewaySessionId} | Members: ${memberIds.length}`);

            running = true;
            while (running) {
                // Fire all channels in parallel, collect retry_after values
                const results = await Promise.all(channels.map(ch => triggerCwel(ch.id, gid, args)));
                let wait = 200;
                for (const r of results) {
                    if (!r.ok && r.retry > wait) wait = r.retry;
                }
                console.log(`⏱ Wait ${wait}ms | hits: ${results.filter(r => r.ok).length}/${channels.length}`);
                if (wait > 0) await new Promise(r => setTimeout(r, wait));
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
        try { if (!interaction.replied) await interaction.reply({ content: '❌', flags: MessageFlags.Ephemeral }); } catch(e) {}
    }
});

client.login(process.env.USER_APP_TOKEN);