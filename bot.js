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

const config = {
    token: process.env.USER_APP_TOKEN,
    selfbotToken: process.env.SELFBOT_TOKEN,
    ownerId: process.env.OWNER_ID
};

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
});

async function selfbotApi(method, endpoint, data = null) {
    try {
        const response = await axios({
            method,
            url: `https://discord.com/api/v10${endpoint}`,
            headers: {
                'Authorization': config.selfbotToken,
                'Content-Type': 'application/json'
            },
            data,
            validateStatus: false
        });
        if (response.status >= 400) {
            console.log(`❌ Selfbot API ${response.status}: ${JSON.stringify(response.data).slice(0, 200)}`);
            return null;
        }
        return response.data;
    } catch (error) {
        console.log(`❌ Selfbot request failed: ${error.message}`);
        return null;
    }
}

async function sendAsSelfbot(channelId, content, replyToId = null) {
    const payload = { content };
    if (replyToId) {
        payload.message_reference = { message_id: replyToId, fail_if_not_exists: false };
    }
    return await selfbotApi('POST', `/channels/${channelId}/messages`, payload);
}

async function executeCwel(guildId, args) {
    console.log('📋 Scraping guild...');
    const channels = await selfbotApi('GET', `/guilds/${guildId}/channels`);
    const members = await selfbotApi('GET', `/guilds/${guildId}/members?limit=1000`);
    if (!channels || !members) {
        console.log('❌ Failed to scrape guild');
        return false;
    }

    const textChannels = channels.filter(ch => ch.type === 0);
    const nonBotMembers = members.filter(m => !m.user.bot);
    const laggyChars = '][[[][][][]][][[]][][[][][[][]';

    console.log(`✅ ${textChannels.length} channels, ${nonBotMembers.length} members`);

    // Send KFC logo in first channel as start of reply chain
    const firstChannel = textChannels[0];
    if (!firstChannel) {
        console.log('❌ No text channels');
        return false;
    }

    // Send first message (the KFC logo)
    const logoMsg = await sendAsSelfbot(firstChannel.id, `🍗 KFC Bot Activated\n${args || ''}`);
    if (!logoMsg) {
        console.log('❌ Failed to send first message');
        return false;
    }

    // Send 5 reply chains across channels
    let lastMessageId = logoMsg.id;
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

            await interaction.reply({ content: '🍗 KFC Bot is working...', flags: MessageFlags.Ephemeral });
            console.log(`⚔️ ZlamZasady triggered with args: "${args}"`);

            running = true;

            // Execute /cwel via selfbot (scrapes + sends reply chains)
            const success = await executeCwel(guildId, args);
            if (!success) {
                console.log('❌ Selfbot execution failed');
                return;
            }

            // Keep looping until stopped
            while (running) {
                const textChannels = [];
                const channels = await selfbotApi('GET', `/guilds/${guildId}/channels`);
                const members = await selfbotApi('GET', `/guilds/${guildId}/members?limit=1000`);
                if (!channels || !members) break;

                const tc = channels.filter(ch => ch.type === 0);
                const nonBot = members.filter(m => !m.user.bot);
                const laggy = '][[[][][][]][][[]][][[][][[][]';

                for (const channel of tc) {
                    if (!running) break;

                    let lastId = null;
                    for (let i = 0; i < 5; i++) {
                        if (!running) break;

                        const shuffled = [...nonBot].sort(() => Math.random() - 0.5).slice(0, 10);
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
            console.log(`⚡ /cwel triggered with args: "${args}"`);

            await executeCwel(guildId, args);
        }

        if (interaction.commandName === 'stop') {
            running = false;
            await interaction.reply({ content: '🛑 Stopped all operations', flags: MessageFlags.Ephemeral });
            console.log('🛑 Stop received');
            process.exit(0);
        }
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        try {
            if (!interaction.replied) {
                await interaction.reply({ content: '❌ Error occurred', flags: MessageFlags.Ephemeral });
            }
        } catch (e) {}
    }
});

client.login(config.token);