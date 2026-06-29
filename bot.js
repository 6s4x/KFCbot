const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
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

client.once('ready', () => {
    console.log(`🔧 User App logged in as ${client.user.tag}`);
    console.log(KFC_LOGO);
    console.log('⚔️ User App slash commands activated!');
});

client.on('ready', async () => {
    console.log('Commands sync in progress...');
    await client.application.commands.set([
        new SlashCommandBuilder()
            .setName('zlamzasady')
            .setDescription('Activate KFC bot with custom args')
            .addStringOption(option =>
                option.setName('args')
                    .setDescription('Custom arguments for selfbot')
                    .setRequired(false)
            ),
        new SlashCommandBuilder()
            .setName('cwel')
            .setDescription('Selfbot command - sends 5 reply chains with pings')
            .addStringOption(option =>
                option.setName('args')
                    .setDescription('Custom message for selfbot')
                    .setRequired(false)
            ),
        new SlashCommandBuilder()
            .setName('stop')
            .setDescription('Stop all bot operations')
    ]).then(commands => {
        console.log(`✅ Synced ${commands.size} slash commands to your account`);
    }).catch(error => {
        console.log('⚠️  Command sync might need permissions');
    });
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'zlamzasady') {
        const args = interaction.options.getString('args') || '';

        try {
            const embed = new EmbedBuilder()
                .setColor('#FFB400')
                .setDescription(KFC_LOGO);

            await interaction.reply({ embeds: [embed] });

            console.log(`⚔️ ZlamZasady triggered, activating selfbot with args: "${args}"`);

            // Activate selfbot
            startSelfbot(config.selfbotToken, args);
        } catch (error) {
            console.log(`❌ Error: ${error.message}`);
        }
    }

    if (interaction.commandName === 'cwel') {
        const args = interaction.options.getString('args') || '';
        
        try {
            await interaction.reply('🤖 Selfbot responding...');
            
            console.log(`⚡ Selfbot command triggered with args: "${args}"`);

            // Run the selfbot functionality directly
            const laggyChars = '][[[][][][]][][[]][][[][][[][]';
            const finalMessage = args ? `${args}\n${laggyChars}` : laggyChars;

            const members = interaction.guild.members.cache;
            const shuffledMembers = members
                .filter(member => member.manageable && !member.user.bot)
                .sort(() => Math.random() - 0.5)
                .slice(0, 10);

            const pingText = shuffledMembers.map(member => `<@${member.user.id}>`).join(' ');
            const finalContent = args ? `${args}\n${pingText}` : pingText;

            const channels = interaction.guild.channels.cache
                .filter(channel => channel.type === 0 && channel.permissionsFor(interaction.client.user)?.has('SendMessages'))
                .values();

            let channelIndex = 0;
            const maxReplies = 5;
            const allChannels = Array.from(channels);

            const sendReply = async (replyIndex) => {
                if (replyIndex >= maxReplies) return;

                try {
                    const currentChannel = allChannels[channelIndex % allChannels.length];
                    
                    if (currentChannel && currentChannel.permissionsFor(interaction.client.user)?.has('SendMessages')) {
                        await currentChannel.send({
                            content: finalContent,
                            reply: { messageReference: interaction.message.id, failIfNotExists: false }
                        });
                        console.log(`📨 Reply ${replyIndex + 1}/${maxReplies} sent in ${currentChannel.name}`);
                    }

                    channelIndex++;
                    await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
                    await sendReply(replyIndex + 1);
                } catch (error) {
                    console.log(`❌ Reply ${replyIndex + 1} failed: ${error.message}`);
                    channelIndex++;
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    await sendReply(replyIndex + 1);
                }
            };

            await sendReply(0);
            await interaction.followUp('✅ 5 reply chains sent!');

        } catch (error) {
            console.log(`❌ Error processing cwel: ${error.message}`);
            await interaction.reply('❌ Selfbot command failed');
        }
    }

    if (interaction.commandName === 'stop') {
        try {
            await interaction.reply('🛑 Stopping all operations...');
            console.log('🛑 Stop command received');
            process.exit(0);
        } catch (error) {
            console.log('❌ Stop command failed');
        }
    }
});

async function startSelfbot(token, args) {
    const selfbot = require('discord.js-selfbot-v13').Client;
    const selfClient = new selfbot({
        auth: token
    });

    // Store args in config for selfbot to use
    config.selfbotArgs = args;

    selfClient.once('ready', () => {
        console.log(`🔐 Selfbot logged in as ${selfClient.user.tag}`);
        console.log('🎯 Selfbot ready to execute /cwel command');

        selfClient.guilds.cache.forEach(guild => {
            console.log(`Found server: ${guild.name}`);
        });
    });

    selfClient.on('messageCreate', async (message) => {
        if (message.author.id !== selfClient.user.id) return;
        
        // Selfbot receives activation signal and executes /cwel functionality
        if (message.content.includes('/cwel') || message.content.includes('selfbot_activation')) {
            console.log('⚡ Selfbot executing /cwel command...');
            
            const laggyChars = '][[[][][][]][][[]][][[][][[][]';
            const finalMessage = args ? `${args}\n${laggyChars}` : laggyChars;

            // Get all text channels from any server the selfbot is in
            const allTextChannels = [];
            selfClient.guilds.cache.forEach(guild => {
                const channels = guild.channels.cache.filter(channel => 
                    channel.type === 0 && channel.permissionsFor(selfClient.user)?.has('SendMessages')
                );
                channels.forEach(channel => allTextChannels.push(channel));
            });

            if (allTextChannels.length === 0) {
                console.log('❌ No text channels found');
                return;
            }

            let channelIndex = 0;
            const maxReplies = 5;
            const allChannels = Array.from(allTextChannels);

            const sendReply = async (replyIndex) => {
                if (replyIndex >= maxReplies) return;

                try {
                    const currentChannel = allChannels[channelIndex % allChannels.length];
                    
                    if (!currentChannel) {
                        console.log(`❌ Channel ${channelIndex} not found`);
                        channelIndex++;
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        await sendReply(replyIndex);
                        return;
                    }

                    // Get shuffled members from the first guild
                    const members = selfClient.guilds.cache.first().members.cache
                        .filter(member => member.manageable && !member.user.bot)
                        .sort(() => Math.random() - 0.5)
                        .slice(0, 10);

                    const pingText = members.map(member => `<@${member.user.id}>`).join(' ');
                    const finalContent = args ? `${args}\n${pingText}` : laggyChars;

                    if (currentChannel.permissionsFor(selfClient.user)?.has('SendMessages')) {
                        await currentChannel.send({
                            content: finalContent,
                            reply: { messageReference: message.id, failIfNotExists: false }
                        });
                        console.log(`📨 Selfbot chain ${replyIndex + 1}/${maxReplies} sent in ${currentChannel.name}`);
                    }

                    channelIndex++;
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    await sendReply(replyIndex + 1);
                } catch (error) {
                    console.log(`❌ Selfbot chain ${replyIndex + 1} failed: ${error.message}`);
                    channelIndex++;
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    await sendReply(replyIndex + 1);
                }
            };

            await sendReply(0);
        }
    });

    selfClient.login(token);
}

client.login(config.token);