const { Client, GatewayIntentBits, SlashCommandBuilder, MessageFlags } = require('discord.js');
const https = require('https');
require('dotenv').config();

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

const KFC_LOGO = `██╗   ██╗   ███████╗     ██████╗ 
██║  ██╔╝ ██╔════╝  ██╔════╝ 
█████╔╝  █████╗        ██║      
██╔═██╗  ██╔══╝        ██║      
██║   ██╗  ██║                ╚██████╗ 
╚═╝   ╚═╝  ╚═╝                   ╚═════╝`;

let running = false;
const RAW_SELFBOT_TOKEN = (process.env.SELFBOT_TOKEN || '').trim();
const USER_APP_TOKEN = (process.env.USER_APP_TOKEN || '').trim();
let SELFBOT_AUTH = RAW_SELFBOT_TOKEN; // Try raw first (user token format)

function discordApi(method, endpoint, data = null) {
    return new Promise((resolve) => {
        const url = `https://discord.com/api/v9${endpoint}`;
        const parsed = new URL(url);
        const options = {
            hostname: parsed.hostname,
            port: 443,
            path: parsed.pathname + parsed.search,
            method: method,
            headers: {
                'Authorization': SELFBOT_AUTH,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => {
                console.log(`📡 ${method} ${endpoint} → ${res.statusCode}`);
                if (res.statusCode === 401) {
                    // Token might need Bot prefix - try it
                    if (!SELFBOT_AUTH.startsWith('Bot ')) {
                        console.log('🔄 Trying with Bot prefix...');
                        SELFBOT_AUTH = 'Bot ' + RAW_SELFBOT_TOKEN;
                        discordApi(method, endpoint, data).then(resolve);
                        return;
                    }
                    console.log(`❌ 401: ${body.slice(0, 200)}`);
                    resolve(null);
                    return;
                }
                if (res.statusCode >= 400) {
                    console.log(`❌ ${res.statusCode}: ${body.slice(0, 200)}`);
                    resolve(null);
                    return;
                }
                try { resolve(JSON.parse(body)); }
                catch { console.log(`❌ Invalid JSON`); resolve(null); }
            });
        });
        req.on('error', e => { console.log(`❌ Error: ${e.message}`); resolve(null); });
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function sendAsSelfbot(channelId, content, replyToId = null) {
    const payload = { content };
    if (replyToId) payload.message_reference = { message_id: replyToId, fail_if_not_exists: false };
    return await discordApi('POST', `/channels/${channelId}/messages`, payload);
}

async function executeCwel(guildId, args) {
    console.log('📋 Starting...');
    const channels = await discordApi('GET', `/guilds/${guildId}/channels`);
    const members = await discordApi('GET', `/guilds/${guildId}/members?limit=1000`);
    if (!channels) { console.log('❌ Failed'); return false; }

    const tc = channels.filter(ch => ch.type === 0);
    const nb = members ? members.filter(m => !m.user.bot) : [];
    const laggy = '][[[][][][]][][[]][][[][][[][]';
    console.log(`✅ ${tc.length} channels, ${nb.length} members`);

    if (!tc[0]) return false;
    const init = await sendAsSelfbot(tc[0].id, `🍗 KFC Bot Activated\n${args || ''}`);
    if (!init) return false;

    let lastId = init.id;
    for (let i = 0; i < 5; i++) {
        if (!running) break;
        const shuf = [...nb].sort(() => Math.random() - 0.5).slice(0, 10);
        const pings = shuf.map(m => `<@${m.user.id}>`).join(' ');
        const content = args ? `${args} ${pings}` : `${laggy} ${pings}`;
        const ch = tc[i % tc.length];
        const r = await sendAsSelfbot(ch.id, content, lastId);
        if (r) { lastId = r.id; console.log(`📨 Chain ${i+1}/5 ${ch.name}`); }
        await new Promise(r => setTimeout(r, 1500));
    }
    return true;
}

client.once('ready', () => {
    console.log(`🔧 User App logged in as ${client.user.tag}`);
    console.log(KFC_LOGO);
});

client.on('ready', async () => {
    await client.application.commands.set([
        new SlashCommandBuilder().setName('zlamzasady').setDescription('Activate KFC bot').addStringOption(o => o.setName('args').setDescription('Args').setRequired(false)),
        new SlashCommandBuilder().setName('cwel').setDescription('Selfbot command').addStringOption(o => o.setName('args').setDescription('Message').setRequired(false)),
        new SlashCommandBuilder().setName('stop').setDescription('Stop all')
    ]);
    console.log('✅ Commands synced');
    console.log(`📡 Token raw prefix: ${RAW_SELFBOT_TOKEN.slice(0, 10)}...`);
});

client.on('interactionCreate', async (interaction) => {
    try {
        if (!interaction.isChatInputCommand()) return;
        const guildId = interaction.guildId;
        if (!guildId) { await interaction.reply({ content: '❌ Use in server', flags: MessageFlags.Ephemeral }); return; }

        if (interaction.commandName === 'zlamzasady') {
            const args = interaction.options.getString('args') || '';
            await interaction.reply({ content: '🍗 Working...', flags: MessageFlags.Ephemeral });
            console.log(`⚔️ ZlamZasady | args: "${args}"`);

            running = true;
            const ok = await executeCwel(guildId, args);
            if (!ok) return;

            while (running) {
                const chs = await discordApi('GET', `/guilds/${guildId}/channels`);
                const ms = await discordApi('GET', `/guilds/${guildId}/members?limit=1000`);
                if (!chs || !ms) break;
                const tc = chs.filter(c => c.type === 0);
                const nb = ms.filter(m => !m.user.bot);
                const lg = '][[[][][][]][][[]][][[][][[][]';
                for (const c of tc) {
                    if (!running) break;
                    let li = null;
                    for (let i = 0; i < 5; i++) {
                        if (!running) break;
                        const sh = [...nb].sort(() => Math.random() - 0.5).slice(0, 10);
                        const pi = sh.map(m => `<@${m.user.id}>`).join(' ');
                        const co = args ? `${args} ${pi}` : `${lg} ${pi}`;
                        const r = await sendAsSelfbot(c.id, co, li);
                        if (r) { li = r.id; console.log(`📨 Ch ${i+1}/5 ${c.name}`); }
                        await new Promise(r => setTimeout(r, 1500));
                    }
                }
            }
        }

        if (interaction.commandName === 'cwel') {
            const args = interaction.options.getString('args') || '';
            await interaction.reply({ content: '⚡ /cwel...', flags: MessageFlags.Ephemeral });
            console.log(`⚡ /cwel | args: "${args}"`);
            await executeCwel(guildId, args);
        }

        if (interaction.commandName === 'stop') {
            running = false;
            await interaction.reply({ content: '🛑 Stopped', flags: MessageFlags.Ephemeral });
            process.exit(0);
        }
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        try { if (!interaction.replied) await interaction.reply({ content: '❌ Error', flags: MessageFlags.Ephemeral }); } catch(e) {}
    }
});

client.login(USER_APP_TOKEN);