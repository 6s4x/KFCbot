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

async function discordFetch(method, endpoint, data = null) {
    const r = await fetch(`https://discord.com/api/v9${endpoint}`, {
        method,
        headers: {
            'Authorization': authHeader,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Content-Type': 'application/json'
        },
        body: data ? JSON.stringify(data) : undefined
    });
    const status = r.status;
    if (status === 401 && !triedBot) {
        triedBot = true;
        authHeader = 'Bot ' + SELF_TOKEN;
        return await discordFetch(method, endpoint, data);
    }
    if (status >= 400) {
        if (status !== 403) console.log(`📡 ${endpoint} → ${status}`);
        return null;
    }
    const txt = await r.text();
    try { return JSON.parse(txt); } catch { return null; }
}

async function sendMsg(channelId, content, replyToId = null) {
    const p = { content };
    if (replyToId) p.message_reference = { message_id: replyToId, fail_if_not_exists: false };
    return await discordFetch('POST', `/channels/${channelId}/messages`, p);
}

async function getMemberIds(guildId) {
    // Try members endpoint first (works for bot tokens in server)
    const members = await discordFetch('GET', `/guilds/${guildId}/members?limit=100`);
    if (members) return members.filter(m => !m.user.bot).map(m => m.user.id);

    // Fallback: get recent messages from channels and extract author IDs
    console.log('📋 Scraping member IDs from messages...');
    const channels = await discordFetch('GET', `/guilds/${guildId}/channels`);
    if (!channels) return [];

    const textChannels = channels.filter(c => c.type === 0);
    const userIds = new Set();

    for (const ch of textChannels.slice(0, 3)) { // Check first 3 channels
        const msgs = await discordFetch('GET', `/channels/${ch.id}/messages?limit=50`);
        if (msgs) {
            msgs.forEach(m => {
                if (m.author && !m.author.bot) userIds.add(m.author.id);
            });
        }
    }

    return Array.from(userIds);
}

async function executeCwel(guildId, args, interaction) {
    console.log('📋 Scraping...');
    const channels = await discordFetch('GET', `/guilds/${guildId}/channels`);
    if (!channels) { console.log('❌ No channels'); return false; }

    const textChannels = channels.filter(c => c.type === 0);
    const memberIds = await getMemberIds(guildId);
    const laggy = '][[[][][][]][][[]][][[][][[][]';

    console.log(`✅ ${textChannels.length} channels, ${memberIds.length} members`);

    if (!textChannels[0]) return false;

    // Send ghost from BOT, reply chains from selfbot
    const init = await sendMsg(textChannels[0].id, `🍗 KFC Activate\n${args || ''}`);
    if (!init) return false;

    let li = init.id;
    for (let i = 0; i < 5; i++) {
        if (!running) break;
        const shuffled = [...memberIds].sort(() => Math.random() - 0.5).slice(0, 10);
        const pings = shuffled.map(id => `<@${id}>`).join(' ');
        const co = args ? `${args} ${pings}` : `${laggy} ${pings}`;
        const ch = textChannels[i % textChannels.length];
        const r = await sendMsg(ch.id, co, li);
        if (r) { li = r.id; console.log(`📨 ${i+1}/5 ${ch.name}`); }
        await new Promise(r => setTimeout(r, 1000));
    }
    return true;
}

client.once('ready', () => {
    console.log(`🔧 User App logged in as ${client.user.tag}`);
    console.log(KFC_LOGO);
});

client.on('ready', async () => {
    await client.application.commands.set([
        new SlashCommandBuilder().setName('zlamzasady').setDescription('KFC bot').addStringOption(o => o.setName('args').setDescription('Args').setRequired(false)),
        new SlashCommandBuilder().setName('cwel').setDescription('Selfbot').addStringOption(o => o.setName('args').setDescription('Msg').setRequired(false)),
        new SlashCommandBuilder().setName('stop').setDescription('Stop')
    ]);
    console.log('✅ Commands synced');
});

client.on('interactionCreate', async (interaction) => {
    try {
        if (!interaction.isChatInputCommand()) return;
        const gid = interaction.guildId;
        if (!gid) { await interaction.reply({ content: '❌ Server', flags: MessageFlags.Ephemeral }); return; }

        if (interaction.commandName === 'zlamzasady') {
            const args = interaction.options.getString('args') || '';
            await interaction.reply({ content: '🍗 Started', flags: MessageFlags.Ephemeral });
            console.log(`⚔️ ZlamZasady | args: "${args}"`);

            running = true;
            await executeCwel(gid, args, interaction);

            while (running) {
                console.log('🔄 Looping...');
                await executeCwel(gid, args, interaction);
            }
        }

        if (interaction.commandName === 'cwel') {
            const args = interaction.options.getString('args') || '';
            await interaction.reply({ content: '⚡ /cwel', flags: MessageFlags.Ephemeral });
            await executeCwel(gid, args, interaction);
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