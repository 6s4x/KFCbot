const { Client, GatewayIntentBits, SlashCommandBuilder, MessageFlags } = require('discord.js');
const axios = require('axios');
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
    console.log('⚡ SELFBOT_TOKEN set:', !!process.env.SELFBOT_TOKEN);
});

async function selfbotApi(method, endpoint, data = null) {
    const token = process.env.SELFBOT_TOKEN;
    if (!token) {
        console.log('❌ No SELFBOT_TOKEN in environment');
        return null;
    }
    try {
        const response = await axios({
            method,
            url: `https://discord.com/api/v10${endpoint}`,
            headers: {
                'Authorization': token,
                'Content-Type': 'application/json'
            },
            data,
            validateStatus: false
        });
        console.log(`✅ API ${method} ${endpoint} → ${response.status}`);
        if (response.status >= 400) {
            console.log(`❌ API error: ${JSON.stringify(response.data).slice(0, 300)}`);
            return null;
        }
        return response.data;
    } catch (error) {
        console.log(`❌ Selfbot request failed: ${error.message}`);
        if (error.response) {
            console.log(`   Status: ${error.response.status}`, JSON.stringify(error.response.data).slice(0, 200));
        }
        return null;
    }
}

async function sendAsSelfbot(channelId, content, replyToId = null) {
    const payload = { content };
    if (replyToId) {
        payload.message_reference = { message_id: replyToId, fail_if_not_exists: false };
    }
    console.log(`📤 Sending to ${channelId}: "${content.slice(0, 50)}..." replyTo: ${replyToId}`);
    return await selfbotApi('POST', `/channels/${channelId}/messages`, payload);
}

async function testSelfbot() {
    console.log('🔍 Testing selfbot connection...');
    const user = await selfbotApi('GET', '/users/@me');
    if (user) {
        console.log(`✅ Selfbot authenticated as ${user.username}`);
        return true;
    }
    console.log('❌ Selfbot authentication failed');
    return false;
}

async function executeCwel(guildId, args) {
    console.log('📋 Starting selfbot execution...');

    // First test the selfbot token
    const isAuthed = await testSelfbot();
    if (!isAuthed) {
        console.log('❌ Cannot proceed - selfbot not authenticated');
        return { success: false, error: 'selfbot_auth_failed' };
    }

    // Get channels
    console.log(`📋 Fetching channels for guild ${guildId}...`);
    const channels = await selfbotApi('GET', `/guilds/${guildId}/channels`);
    if (!channels) {
        console.log('❌ Failed to get channels');
        return { success: false, error: 'no_channels' };
    }

    const textChannels = channels.filter(ch => ch.type === 0);
    console.log(`✅ Found ${textChannels.length} text channels`);

    if (textChannels.length === 0) {
        console.log('❌ No text channels available');
        return { success: false, error: 'no_text_channels' };
    }

    // Get members
    console.log(`📋 Fetching members for guild ${guildId}...`);
    const members = await selfbotApi('GET', `/guilds/${guildId}/members?limit=1000`);
    if (!members) {
        console.log('❌ Failed to get members - continuing with empty list');
    }

    const nonBotMembers = members ? members.filter(m => !m.user.bot) : [];
    console.log(`✅ Found ${nonBotMembers.length} non-bot members`);

    const laggyChars = '][[[][][][]][][[]][][[][][[][]';

    // Send first message in first text channel
    const firstChannel = textChannels[0];
    console.log(`📤 Sending initial message to #${firstChannel.name}...`);

    const initMsg = await sendAsSelfbot(firstChannel.id, `🍗 KFC Bot Activated\n${args || ''}`);
    if (!initMsg) {
        console.log('❌ Failed to send initial message');
        return { success: false, error: 'send_failed' };
    }
    console.log(`✅ Initial message sent (ID: ${initMsg.id})`);

    // Send 5 reply chains
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

    console.log('✅ /cwel execution complete');
    return { success: true };
}

client.on('interactionCreate', async (interaction) => {
    try {
        if (!interaction.isChatInputCommand()) return;

        if (interaction.commandName === 'zlamzasady') {
            const args = interaction.options.getString('args') || '';
            const guildId = interaction.guildId;

            if (!guildId) {
                await interaction.reply({ content: '❌ Use this in a server', flags: MessageFlags.Ephemeral });
                return;
            }

            await interaction.reply({ content: '🍗 KFC Bot working...', flags: MessageFlags.Ephemeral });
            console.log(`⚔️ ZlamZasady triggered | guild: ${guildId} | args: "${args}"`);

            running = true;

            // Execute initial /cwel
            const result = await executeCwel(guildId, args);
            if (!result.success) {
                console.log(`❌ Initial execution failed: ${result.error}`);
                running = false;
                return;
            }

            // Loop until stopped
            while (running) {
                const channels = await selfbotApi('GET', `/guilds/${guildId}/channels`);
                const members = await selfbotApi('GET', `/guilds/${guildId}/members?limit=1000`);
                if (!channels || !members) break;

                const textChannels = channels.filter(ch => ch.type === 0);
                const nonBotMembers = members.filter(m => !m.user.bot);
                const laggy = '][[[][][][]][][[]][][[][][[][]';

                for (const channel of textChannels) {
                    if (!running) break;

                    let lastId = null;
                    for (let i = 0; i < 5; i++) {
                        if (!running) break;

                        const shuffled = [...nonBotMembers].sort(() => Math.random() - 0.5).slice(0, 10);
                        const pings = shuffled.map(m => `<@${m.user.id}>`).join(' ');
                        const content = args ? `${args} ${pings}` : `${laggy} ${pings}`;

                        const result = await sendAsSelfbot(channel.id, content, lastId);
                        if (result) {
                            lastId = result.id;
                            console.log(`📨 Chain ${i+1}/5 in #${channel.name}`);
                        }

                        await new Promise(resolve => setTimeout(resolve, 1500));
                    }
                }
            }
        }

        if (interaction.commandName === 'cwel') {
            const args = interaction.options.getString('args') || '';
            const guildId = interaction.guildId;

            if (!guildId) {
                await interaction.reply({ content: '❌ Use this in a server', flags: MessageFlags.Ephemeral });
                return;
            }

            await interaction.reply({ content: '⚡ Executing /cwel...', flags: MessageFlags.Ephemeral });
            console.log(`⚡ /cwel triggered | guild: ${guildId} | args: "${args}"`);

            await executeCwel(guildId, args);
            console.log('✅ /cwel done');
        }

        if (interaction.commandName === 'stop') {
            running = false;
            await interaction.reply({ content: '🛑 Stopped', flags: MessageFlags.Ephemeral });
            console.log('🛑 Stop received');
            process.exit(0);
        }
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        console.log(error.stack);
        try {
            if (!interaction.replied) {
                await interaction.reply({ content: '❌ Error occurred', flags: MessageFlags.Ephemeral });
            }
        } catch (e) {}
    }
});

client.login(process.env.USER_APP_TOKEN);