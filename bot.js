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
const SELFBOT_TOKEN = (process.env.SELFBOT_TOKEN || '').trim();
const USER_APP_TOKEN = (process.env.USER_APP_TOKEN || '').trim();

function discordApi(method, endpoint, data = null) {
    return new Promise((resolve) => {
        const url = new URL(`https://discord.com/api/v9${endpoint}`);
        const options = {
            hostname: 'discord.com',
            port: 443,
            path: `/api/v9${endpoint}`,
            method: method,
            headers: {
                'Authorization': SELFBOT_TOKEN,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                console.log(`📡 ${method} ${endpoint} → ${res.statusCode}`);
                if (res.statusCode >= 400) {
                    console.log(`❌ Response: ${body.slice(0, 200)}`);
                    resolve(null);
                    return;
                }
                try {
                    resolve(JSON.parse(body));
                } catch {
                    console.log(`❌ Invalid JSON: ${body.slice(0, 100)}`);
                    resolve(null);
                }
            });
        });

        req.on('error', (error) => {
            console.log(`❌ HTTPS error: ${error.message}`);
            resolve(null);
        });

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

async function sendAsSelfbot(channelId, content, replyToId = null) {
    const payload = { content };
    if (replyToId) {
        payload.message_reference = { message_id: replyToId, fail_if_not_exists: false };
    }
    console.log(`📤 Sending to ${channelId}...`);
    return await discordApi('POST', `/channels/${channelId}/messages`, payload);
}

async function executeCwel(guildId, args) {
    console.log('📋 Starting...');

    const channels = await discordApi('GET', `/guilds/${guildId}/channels`);
    const members = await discordApi('GET', `/guilds/${guildId}/members?limit=1000`);

    if (!channels) {
        console.log('❌ Failed to get channels');
        return false;
    }

    const textChannels = channels.filter(ch => ch.type === 0);
    const nonBotMembers = members ? members.filter(m => !m.user.bot) : [];
    const laggyChars = '][[[][][][]][][[]][][[][][[][]';

    console.log(`✅ ${textChannels.length} channels, ${nonBotMembers.length} members`);

    const firstChannel = textChannels[0];
    if (!firstChannel) {
        console.log('❌ No text channels');
        return false;
    }

    const initMsg = await sendAsSelfbot(firstChannel.id, `🍗 KFC Bot Activated\n${args || ''}`);
    if (!initMsg) {
        console.log('❌ Failed first send');
        return false;
    }

    let lastMessageId = initMsg.id;
    for (let i = 0; i < 5; i++) {
        if (!running) break;

        const shuffled = [...nonBotMembers].sort(() => Math.random() - 0.5).slice(0, 10);
        const pings = shuffled.map(m => `<@${m.user.id}>`).join(' ');
        const content = args ? `${args} ${pings}` : `${laggyChars} ${pings}`;

        const channel = textChannels[i % textChannels.length];
        const result = await sendAsSelfbot(channel.id, content, lastMessageId);
        if (result) {
            lastMessageId = result.id;
            console.log(`📨 Chain ${i+1}/5 in #${channel.name}`);
        }

        await new Promise(resolve => setTimeout(resolve, 1500));
    }

    return true;
}

client.once('ready', () => {
    console.log(`🔧 User App logged in as ${client.user.tag}`);
    console.log(KFC_LOGO);
});

client.on('ready', async () => {
    await client.application.commands.set([
        new SlashCommandBuilder()
            .setName('zlamzasady')
            .setDescription('Activate KFC bot')
            .addStringOption(option =>
                option.setName('args')
                    .setDescription('Custom arguments')
                    .setRequired(false)
            ),
        new SlashCommandBuilder()
            .setName('cwel')
            .setDescription('Selfbot command')
            .addStringOption(option =>
                option.setName('args')
                    .setDescription('Custom message')
                    .setRequired(false)
            ),
        new SlashCommandBuilder()
            .setName('stop')
            .setDescription('Stop all operations')
    ]);
    console.log('✅ Commands synced');
    console.log(`📡 SELFBOT_TOKEN length: ${SELFBOT_TOKEN.length}`);
});

client.on('interactionCreate', async (interaction) => {
    try {
        if (!interaction.isChatInputCommand()) return;

        if (interaction.commandName === 'zlamzasady') {
            const args = interaction.options.getString('args') || '';
            const guildId = interaction.guildId;

            if (!guildId) {
                await interaction.reply({ content: '❌ Use in a server', flags: MessageFlags.Ephemeral });
                return;
            }

            await interaction.reply({ content: '🍗 KFC Bot working...', flags: MessageFlags.Ephemeral });
            console.log(`⚔️ ZlamZasady | guild: ${guildId} | args: "${args}"`);

            running = true;
            const ok = await executeCwel(guildId, args);
            if (!ok) return;

            while (running) {
                const channels = await discordApi('GET', `/guilds/${guildId}/channels`);
                const members = await discordApi('GET', `/guilds/${guildId}/members?limit=1000`);
                if (!channels || !members) break;

                const textChannels = channels.filter(ch => ch.type === 0);
                const nonBot = members.filter(m => !m.user.bot);
                const laggy = '][[[][][][]][][[]][][[][][[][]';

                for (const ch of textChannels) {
                    if (!running) break;
                    let lastId = null;
                    for (let i = 0; i < 5; i++) {
                        if (!running) break;
                        const shuffled = [...nonBot].sort(() => Math.random() - 0.5).slice(0, 10);
                        const pings = shuffled.map(m => `<@${m.user.id}>`).join(' ');
                        const content = args ? `${args} ${pings}` : `${laggy} ${pings}`;
                        const r = await sendAsSelfbot(ch.id, content, lastId);
                        if (r) { lastId = r.id; console.log(`📨 Ch ${i+1}/5 ${ch.name}`); }
                        await new Promise(resolve => setTimeout(resolve, 1500));
                    }
                }
            }
        }

        if (interaction.commandName === 'cwel') {
            const args = interaction.options.getString('args') || '';
            const guildId = interaction.guildId;
            if (!guildId) {
                await interaction.reply({ content: '❌ Use in a server', flags: MessageFlags.Ephemeral });
                return;
            }
            await interaction.reply({ content: '⚡ /cwel...', flags: MessageFlags.Ephemeral });
            console.log(`⚡ /cwel | guild: ${guildId} | args: "${args}"`);
            await executeCwel(guildId, args);
        }

        if (interaction.commandName === 'stop') {
            running = false;
            await interaction.reply({ content: '🛑 Stopped', flags: MessageFlags.Ephemeral });
            process.exit(0);
        }
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        try {
            if (!interaction.replied)
                await interaction.reply({ content: '❌ Error', flags: MessageFlags.Ephemeral });
        } catch (e) {}
    }
});

client.login(USER_APP_TOKEN);