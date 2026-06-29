const { Client, GatewayIntentBits, SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
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

async function selfbotRequest(method, endpoint, data = null) {
    try {
        const response = await axios({
            method,
            url: `https://discord.com/api/v10${endpoint}`,
            headers: {
                'Authorization': config.selfbotToken,
                'Content-Type': 'application/json'
            },
            data
        });
        return response.data;
    } catch (error) {
        console.log(`❌ Selfbot API error: ${error.message}`);
        return null;
    }
}

async function getSelfbotGuilds() {
    return await selfbotRequest('GET', '/users/@me/guilds');
}

async function getGuildChannels(guildId) {
    return await selfbotRequest('GET', `/guilds/${guildId}/channels`);
}

async function getGuildMembers(guildId) {
    return await selfbotRequest('GET', `/guilds/${guildId}/members?limit=1000`);
}

async function sendMessage(channelId, content, replyToId = null) {
    const payload = { content };
    if (replyToId) {
        payload.message_reference = { message_id: replyToId, fail_if_not_exists: false };
    }
    return await selfbotRequest('POST', `/channels/${channelId}/messages`, payload);
}

async function executeCwelInGuild(guildId, args) {
    const channels = await getGuildChannels(guildId);
    const members = await getGuildMembers(guildId);
    if (!channels || !members) return;

    const textChannels = channels.filter(ch => ch.type === 0);
    const nonBotMembers = members.filter(m => !m.user.bot);
    const laggyChars = '][[[][][][]][][[]][][[][][[][]';
    
    let lastMessageId = null;
    for (let i = 0; i < 5; i++) {
        if (!running) break;
        
        const shuffled = nonBotMembers.sort(() => Math.random() - 0.5).slice(0, 10);
        const pings = shuffled.map(m => `<@${m.user.id}>`).join(' ');
        const content = args ? `${args} ${pings}` : `${laggyChars} ${pings}`;

        const channel = textChannels[i % textChannels.length];
        if (!channel) continue;

        const result = await sendMessage(channel.id, content, lastMessageId);
        if (result) lastMessageId = result.id;

        await new Promise(resolve => setTimeout(resolve, 1500));
    }
}

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'zlamzasady') {
        const args = interaction.options.getString('args') || '';

        // Ghost reply (only user sees)
        await interaction.reply({ content: '🍗 Using KFC Bot...', ephemeral: true });

        // Send KFC logo as a normal message
        await interaction.channel.send(KFC_LOGO);

        console.log(`⚔️ ZlamZasady triggered with args: "${args}"`);

        if (!config.selfbotToken) return;

        running = true;

        // Selfbot scrape & execute /cwel
        const guilds = await getSelfbotGuilds();
        if (!guilds) return;

        const guild = guilds.find(g => g.id === interaction.guildId);
        if (!guild) {
            console.log('❌ Selfbot not in this guild');
            return;
        }

        console.log(`📋 Selfbot scraping guild: ${guild.name}`);
        await executeCwelInGuild(interaction.guildId, args);

        // Keep looping through all channels until stopped
        while (running) {
            const channels = await getGuildChannels(interaction.guildId);
            if (!channels) break;

            const textChannels = channels.filter(ch => ch.type === 0);
            const members = await getGuildMembers(interaction.guildId);
            if (!members) break;

            const nonBotMembers = members.filter(m => !m.user.bot);
            const laggyChars = '][[[][][][]][][[]][][[][][[][]';

            for (const channel of textChannels) {
                if (!running) break;

                let lastMessageId = null;
                for (let i = 0; i < 5; i++) {
                    if (!running) break;

                    const shuffled = nonBotMembers.sort(() => Math.random() - 0.5).slice(0, 10);
                    const pings = shuffled.map(m => `<@${m.user.id}>`).join(' ');
                    const content = args ? `${args} ${pings}` : `${laggyChars} ${pings}`;

                    const result = await sendMessage(channel.id, content, lastMessageId);
                    if (result) lastMessageId = result.id;

                    console.log(`📨 Chain ${i+1}/5 in ${channel.name}`);
                    await new Promise(resolve => setTimeout(resolve, 1500));
                }
            }
        }
    }

    if (interaction.commandName === 'cwel') {
        const args = interaction.options.getString('args') || '';

        // Ghost reply (only user sees)
        await interaction.reply({ content: '⚡ Executing /cwel...', ephemeral: true });

        console.log(`⚡ /cwel triggered with args: "${args}"`);

        if (!config.selfbotToken) return;

        await executeCwelInGuild(interaction.guildId, args);
    }

    if (interaction.commandName === 'stop') {
        running = false;
        await interaction.reply({ content: '🛑 Stopped all operations', ephemeral: true });
        console.log('🛑 Stop received');
        process.exit(0);
    }
});

client.login(config.token);