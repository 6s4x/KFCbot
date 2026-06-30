const { Client, GatewayIntentBits, SlashCommandBuilder, MessageFlags } = require('discord.js');
const { Client: SelfClient } = require('discord.js-selfbot-v13');
const WebSocket = require('ws');
require('dotenv').config();

const KFC_LOGO = `██╗   ██╗   ███████╗     ██████╗ 
██║  ██╔╝ ██╔════╝  ██╔════╝ 
█████╔╝  █████╗        ██║      
██╔═██╗  ██╔══╝        ██║      
██║   ██╗  ██║                ╚██████╗ 
╚═╝   ╚═╝  ╚═╝                   ╚═════╝`;

const ZLAM_ASCII = `██╗  ██╗ ███████╗  ██████╗ 
██║ ██╔╝ ██╔════╝ ██╔════╝ 
█████╔╝  █████╗   ██║      
██╔═██╗  ██╔══╝   ██║      
██║  ██╗ ██║      ╚██████╗ 
╚═╝  ╚═╝ ╚═╝       ╚═════╝`;

let running = false;
const SELF_TOKEN = (process.env.SELFBOT_TOKEN || '').trim();
let selfClient = null;
let memberIds = [];
let cwelCmdId = null, cwelVersion = null, appId = null;
let gatewaySessionId = null;
let channels = [];

const bot = new Client({ intents: [GatewayIntentBits.Guilds] });

async function fetchMembers(guildId) {
    if (!selfClient || !selfClient.guilds.cache.has(guildId)) return [];
    const guild = selfClient.guilds.cache.get(guildId);
    await guild.members.fetch();
    const ids = [];
    guild.members.cache.forEach(m => { if (!m.user.bot) ids.push(m.user.id); });
    return ids;
}

function connectGateway(guildId) {
    return new Promise((resolve) => {
        const ws = new WebSocket('wss://gateway.discord.gg/?v=9&encoding=json');
        let hb;
        ws.on('open', () => ws.send(JSON.stringify({ op: 2, d: { token: SELF_TOKEN, properties: { $os: 'linux', $browser: 'chrome', $device: 'pc' }, intents: 0 } }));
        ws.on('message', (data) => {
            const p = JSON.parse(data.toString());
            if (p.op === 10) hb = setInterval(() => ws.send(JSON.stringify({ op: 1, d: null })), p.d.heartbeat_interval);
            if (p.op === 0 && p.t === 'READY') {
                gatewaySessionId = p.d.session_id;
                console.log(`🟢 Gateway READY | session: ${gatewaySessionId}`);
                ws.send(JSON.stringify({ op: 8, d: { guild_id: guildId, query: '', limit: 0 } }));
            }
        });
        ws.on('close', () => { clearInterval(hb); resolve(gatewaySessionId); });
        ws.on('error', () => resolve(gatewaySessionId));
        setTimeout(() => { console.log(`⏰ GW timeout`); resolve(gatewaySessionId); }, 8000);
    });
}

async function triggerCwel(channelId, guildId, args) {
    if (!cwelCmdId || !cwelVersion || !gatewaySessionId) return { ok: false, retry: 0 };
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

bot.once('ready', () => {
    console.log(`🔧 Bot: ${bot.user.tag}`);
    console.log(KFC_LOGO);
    appId = bot.user.id;
});

bot.on('ready', async () => {
    const cmds = await bot.application.commands.set([
        new SlashCommandBuilder().setName('zlamzasady').setDescription('KFC').addStringOption(o => o.setName('args').setDescription('Args').setRequired(false)),
        new SlashCommandBuilder().setName('cwel').setDescription('Cwel').addStringOption(o => o.setName('args').setDescription('Msg').setRequired(false)),
        new SlashCommandBuilder().setName('stop').setDescription('Stop')
    ]);
    const cwel = cmds.find(c => c.name === 'cwel');
    cwelCmdId = cwel.id; cwelVersion = cwel.version;
    console.log(`✅ Synced | /cwel ID: ${cwelCmdId} | v: ${cwelVersion}`);
});

bot.on('interactionCreate', async (interaction) => {
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
            await interaction.reply({ content: ZLAM_ASCII, flags: MessageFlags.Ephemeral });
            console.log(`⚔️ Start | args: "${args}"`);

            const chs = await fetch(`https://discord.com/api/v9/guilds/${gid}/channels`, {
                headers: { 'Authorization': SELF_TOKEN }
            }).then(r => r.json()).catch(() => null);
            channels = chs ? chs.filter(c => c.type === 0) : [];
            console.log(`✅ ${channels.length} channels`);

            memberIds = await fetchMembers(gid);
            console.log(`✅ Members: ${memberIds.length}`);
            if (memberIds.length === 0) console.log(`⚠️ No members`);

            await connectGateway(gid);
            console.log(`🟢 Gateway connected | session: ${gatewaySessionId}`);

            running = true;
            console.log(`🔄 Starting spam loop...`);
            while (running) {
                const results = await Promise.all(channels.map(ch => triggerCwel(ch.id, gid, args)));
                const ok = results.filter(r => r.ok).length;
                console.log(`📤 Triggered /cwel in ${ok}/${channels.length} channels`);
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

selfClient = new SelfClient();
selfClient.login(SELF_TOKEN).then(() => console.log(`🟢 Selfbot ready: ${selfClient.user.tag}`)).catch(e => console.log(`❌ Selfbot login failed: ${e.message}`));

bot.login(process.env.USER_APP_TOKEN);