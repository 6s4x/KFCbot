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
const OWNER_ID = (process.env.OWNER_ID || '').trim();
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

        ws.on('open', () => {
            console.log(`🔌 GW open, identifying...`);
            ws.send(JSON.stringify({ op: 2, d: { token: SELF_TOKEN, properties: { $os: 'linux', $browser: 'chrome', $device: 'pc' }, intents: 0, large_threshold: 250 } }));
        });

        ws.on('message', (data) => {
            const p = JSON.parse(data.toString());

            // Heartbeat
            if (p.op === 10) {
                console.log(`💓 Heartbeat interval: ${p.d.heartbeat_interval}`);
                hb = setInterval(() => ws.send(JSON.stringify({ op: 1, d: null })), p.d.heartbeat_interval);
            }

            // READY
            if (p.op === 0 && p.t === 'READY') {
                gatewaySessionId = p.d.session_id;
                console.log(`🟢 READY | session: ${gatewaySessionId} | user: ${p.d.user?.id} ${p.d.user?.username}`);
                console.log(`🔍 Guilds in READY: ${(p.d.guilds || []).length}`);
                // Request members via OP 8
                console.log(`🔍 Sending OP 8 for guild ${guildId}...`);
                ws.send(JSON.stringify({ op: 8, d: { guild_id: guildId, query: '', limit: 0 } }));
            }

            // GUILD_CREATE
            if (p.op === 0 && p.t === 'GUILD_CREATE') {
                const g = p.d;
                console.log(`🏘️ GUILD_CREATE | id: ${g.id} | name: ${g.name} | members: ${g.members?.length || 0}`);
                if (g.id === guildId && g.members) {
                    const before = memberIds.length;
                    g.members.forEach(m => { if (!m.user?.bot && !memberIds.includes(m.user.id)) memberIds.push(m.user.id); });
                    console.log(`✅ GUILD_CREATE gave ${memberIds.length - before} new members (total: ${memberIds.length})`);
                } else if (g.id === guildId) {
                    console.log(`⚠️ GUILD_CREATE has no members field`);
                }
            }

            // GUILD_MEMBERS_CHUNK
            if (p.op === 0 && p.t === 'GUILD_MEMBERS_CHUNK') {
                const chunk = p.d;
                const before = memberIds.length;
                chunk.members.forEach(m => { if (!m.user?.bot && !memberIds.includes(m.user.id)) memberIds.push(m.user.id); });
                console.log(`🧩 CHUNK | guild: ${chunk.guild_id} | chunk ${chunk.chunk_index+1}/${chunk.chunk_count} | got ${chunk.members.length} members (total: ${memberIds.length})`);
            }

            // Log unknown events (debug)
            if (p.op === 0 && !['READY', 'GUILD_CREATE', 'GUILD_MEMBERS_CHUNK'].includes(p.t)) {
                console.log(`📡 GW event: ${p.t}`);
            }
        });

        ws.on('close', (code, reason) => {
            console.log(`🔌 GW closed: ${code} ${reason || ''}`);
            clearInterval(hb);
            resolve(gatewaySessionId);
        });

        ws.on('error', (err) => {
            console.log(`❌ GW error: ${err.message}`);
            resolve(gatewaySessionId);
        });

        setTimeout(() => {
            console.log(`⏰ GW timeout — resolving with session=${gatewaySessionId}, members=${memberIds.length}`);
            resolve(gatewaySessionId);
        }, 12000);
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
        const shuf = [...memberIds].sort(() => Math.random() - 0.5).slice(0, Math.min(10, memberIds.length));
        const pings = shuf.length > 0 ? ' ' + shuf.map(id => `<@${id}>`).join(' ') : ' (no members)';
        const content = args ? `${args}${pings}` : `${laggy}${pings}`;
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
    console.log(KFC_LOGO);
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

        if (interaction.user.id !== OWNER_ID) {
            await interaction.reply({ content: '❌ No permission', flags: MessageFlags.Ephemeral });
            return;
        }

        const gid = interaction.guildId;
        if (!gid) { await interaction.reply({ content: '❌', flags: MessageFlags.Ephemeral }); return; }
        const args = interaction.options.getString('args') || '';

        if (interaction.commandName === 'zlamzasady') {
            await interaction.reply({ content: '🍗 Start', flags: MessageFlags.Ephemeral });
            console.log(`⚔️ Start | args: "${args}"`);

            const chs = await sf('GET', `/guilds/${gid}/channels`);
            channels = chs ? chs.filter(c => c.type === 0) : [];
            console.log(`✅ ${channels.length} channels`);

            // Scrape members via REST (user tokens can access own guild member lists)
            const restMembers = await sf('GET', `/guilds/${gid}/members?limit=1000`);
            if (restMembers) {
                restMembers.forEach(m => { if (!m.user?.bot && !memberIds.includes(m.user.id)) memberIds.push(m.user.id); });
                console.log(`✅ Members via REST: ${memberIds.length}`);
            }

            await connectGateway(gid);
            console.log(`🏁 Gateway done | session: ${gatewaySessionId} | Members: ${memberIds.length}`);

            running = true;
            while (running) {
                const results = await Promise.all(channels.map(ch => triggerCwel(ch.id, gid, args)));
                let wait = 200;
                for (const r of results) {
                    if (!r.ok && r.retry > wait) wait = r.retry;
                }
                console.log(`⏱ Wait ${wait}ms | hits: ${results.filter(r => r.ok).length}/${channels.length}`);
                if (wait > 0) await new Promise(r => setTimeout(r, wait));
            }
            console.log('🛑 Loop stopped');
        }

        if (interaction.commandName === 'cwel') {
            console.log(`⚡ Cwel | args: "${args}"`);
            await handleCwel(interaction, args);
        }

        if (interaction.commandName === 'stop') {
            running = false;
            await interaction.reply({ content: '🛑 Stopped', flags: MessageFlags.Ephemeral });
        }
    } catch (error) {
        console.log(`❌ ${error.message}`);
        try { if (!interaction.replied) await interaction.reply({ content: '❌', flags: MessageFlags.Ephemeral }); } catch(e) {}
    }
});

client.login(process.env.USER_APP_TOKEN);