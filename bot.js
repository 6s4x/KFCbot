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
    if (r.status >= 400) { console.log(`❌ REST ${r.status} ${endpoint}: ${txt.slice(0, 200)}`); return null; }
    try { return JSON.parse(txt); } catch { return null; }
}

function connectGateway(guildId) {
    return new Promise((resolve) => {
        const ws = new WebSocket('wss://gateway.discord.gg/?v=9&encoding=json');
        let hb;

        ws.on('open', () => {
            console.log(`🔌 GW open, identifying...`);
            ws.send(JSON.stringify({ op: 2, d: { token: SELF_TOKEN, properties: { $os: 'linux', $browser: 'chrome', $device: 'pc' }, intents: 0 } }));
        });

        ws.on('message', (data) => {
            const p = JSON.parse(data.toString());

            if (p.op === 10) {
                hb = setInterval(() => ws.send(JSON.stringify({ op: 1, d: null })), p.d.heartbeat_interval);
            }

            if (p.op === 0 && p.t === 'READY') {
                gatewaySessionId = p.d.session_id;
                console.log(`🟢 READY | session: ${gatewaySessionId} | user: ${p.d.user?.id}`);
                const guildsInReady = (p.d.guilds || []).map(g => ({ id: g.id, name: g.name, unavailable: g.unavailable }));
                console.log(`🔍 Selfbot guilds in READY:`);
                guildsInReady.forEach(g => console.log(`   - ${g.id} (${g.name})${g.unavailable ? ' [UNAVAILABLE]' : ''}`));
                console.log(`🎯 Target guild: ${guildId} | Match: ${guildsInReady.some(g => g.id === guildId) ? 'YES ✅' : 'NO ❌'}`);
                ws.send(JSON.stringify({ op: 8, d: { guild_id: guildId, query: '', limit: 0 } }));
            }

            if (p.op === 0 && p.t === 'GUILD_CREATE') {
                const g = p.d;
                console.log(`🏘️ GUILD_CREATE | id: ${g.id} | name: ${g.name} | members: ${g.members?.length || 0}`);
                if (g.id === guildId && g.members) {
                    const before = memberIds.length;
                    g.members.forEach(m => { if (!m.user?.bot && !memberIds.includes(m.user.id)) memberIds.push(m.user.id); });
                    console.log(`✅ GUILD_CREATE gave ${memberIds.length - before} members (total: ${memberIds.length})`);
                }
            }

            if (p.op === 0 && p.t === 'GUILD_MEMBERS_CHUNK') {
                const chunk = p.d;
                const before = memberIds.length;
                chunk.members.forEach(m => { if (!m.user?.bot && !memberIds.includes(m.user.id)) memberIds.push(m.user.id); });
                console.log(`🧩 CHUNK | ${chunk.chunk_index+1}/${chunk.chunk_count} | got ${chunk.members.length} (total: ${memberIds.length})`);
            }
        });

        ws.on('close', (code, reason) => {
            console.log(`🔌 GW closed: ${code} ${reason || ''}`);
            clearInterval(hb);
            resolve(gatewaySessionId);
        });
        ws.on('error', (err) => { console.log(`❌ GW error: ${err.message}`); resolve(gatewaySessionId); });
        setTimeout(() => { console.log(`⏰ GW timeout — session=${gatewaySessionId}, members=${memberIds.length}`); resolve(gatewaySessionId); }, 15000);
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
    if (r.status === 429) { const b = await r.json(); return { ok: false, retry: (b.retry_after || 1) * 1000 }; }
    return { ok: false, retry: 200 };
}

async function handleCwel(interaction, args) {
    const laggy = '][[[][][][]][][[]][][[][][[][]';
    await interaction.reply({ content: `⚡ /cwel`, flags: MessageFlags.Ephemeral });
    const wh = `https://discord.com/api/v9/webhooks/${appId}/${interaction.token}`;
    let lastId = null;
    for (let i = 0; i < 5; i++) {
        const shuf = [...memberIds].sort(() => Math.random() - 0.5).slice(0, Math.min(10, memberIds.length));
        const pings = shuf.length > 0 ? ' ' + shuf.map(id => `<@${id}>`).join(' ') : '';
        const content = args ? `${args}${pings}` : `${laggy}${pings}`;
        const payload = { content };
        if (lastId) payload.message_reference = { message_id: lastId, fail_if_not_exists: false };
        const r = await fetch(wh + '?wait=true', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        if (r.ok) { const d = await r.json(); lastId = d.id; console.log(`📨 Bot ${i+1}/5`); }
        else if (r.status === 429) { const b = await r.json(); await new Promise(r2 => setTimeout(r2, (b.retry_after || 1) * 1000)); i--; }
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
        if (interaction.user.id !== '1521316414550442034' && interaction.user.id !== '353523625531277325') {
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

            // Verify selfbot guild membership
            const userGuilds = await sf('GET', '/users/@me/guilds');
            console.log(`📡 Selfbot guilds via REST (${userGuilds?.length || 0}):`);
            userGuilds?.forEach(g => console.log(`   - ${g.id} (${g.name})${g.id === gid ? ' ✅ TARGET' : ''}`));
            console.log(`🎯 Target guild ${gid} in selfbot guilds: ${userGuilds?.some(g => g.id === gid) ? 'YES' : 'NO'}`);

            await connectGateway(gid);
            console.log(`🏁 Gateway done | session: ${gatewaySessionId} | Members: ${memberIds.length}`);

            running = true;
            while (running) {
                const results = await Promise.all(channels.map(ch => triggerCwel(ch.id, gid, args)));
                let wait = 0;
                for (const r of results) if (!r.ok && r.retry > wait) wait = r.retry;
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