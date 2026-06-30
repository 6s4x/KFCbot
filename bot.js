const { Client, GatewayIntentBits, SlashCommandBuilder, MessageFlags } = require('discord.js');
const { Client: SelfClient } = require('discord.js-selfbot-v13');
require('dotenv').config();

const KFC_LOGO = `██╗   ██╗   ███████╗     ██████╗ 
██║  ██╔╝ ██╔════╝  ██╔════╝ 
█████╔╝  █████╗        ██║      
██╔═██╗  ██╔══╝        ██║      
██║   ██╗  ██║                ╚██████╗ 
╚═╝   ╚═╝  ╚═╝                   ╚═════╝`;

let running = false;
const SELF_TOKEN = (process.env.SELFBOT_TOKEN || '').trim();
let selfClient = null;
let memberIds = [];
let cwelCmdId = null, cwelVersion = null, appId = null;
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

async function triggerCwel(channelId, guildId, args) {
    if (!cwelCmdId || !cwelVersion) return { ok: false, retry: 0 };
    const nonce = Date.now().toString() + Math.random().toString(36).slice(2, 8);
    const payload = {
        type: 2, application_id: appId, guild_id: guildId,
        channel_id: channelId,
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
            await interaction.reply({ content: '🍗 Start', flags: MessageFlags.Ephemeral });
            console.log(`⚔️ Start | args: "${args}"`);

            const chs = await bot.guilds.fetch(gid).then(g => g.channels.fetch()).catch(() => null);
            channels = chs ? Array.from(chs.values()).filter(c => c.type === 0) : [];
            console.log(`✅ ${channels.length} channels`);

            memberIds = await fetchMembers(gid);
            console.log(`✅ Members: ${memberIds.length}`);
            if (memberIds.length === 0) console.log(`⚠️ No members - selfbot may not be in guild`);

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

selfClient = new SelfClient();
selfClient.login(SELF_TOKEN).then(() => console.log(`🟢 Selfbot ready: ${selfClient.user.tag}`)).catch(e => console.log(`❌ Selfbot login failed: ${e.message}`));

bot.login(process.env.USER_APP_TOKEN);