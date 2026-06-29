const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
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
    token: process.env.BOT_TOKEN,
    selfbotToken: process.env.SELFBOT_TOKEN,
    ownerId: process.env.OWNER_ID
};

client.once('ready', () => {
    console.log(`Bot logged in as ${client.user.tag}`);
    console.log(KFC_LOGO);
});

client.on('ready', () => {
    client.application.commands.set([
        new SlashCommandBuilder()
            .setName('ZlamZasady')
            .setDescription('Initialize KFC bot with custom arguments')
            .addStringOption(option =>
                option.setName('args')
                    .setDescription('Custom arguments for the bot')
                    .setRequired(false)
            ),
        new SlashCommandBuilder()
            .setName('Stop')
            .setDescription('Stop all bot operations')
    ]).then(() => console.log('Commands registered!'));
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'ZlamZasady') {
        const args = interaction.options.getString('args') || '';

        const embed = new EmbedBuilder()
            .setColor('#FFB400')
            .setTitle('KFC Bot Initialized!')
            .setDescription(KFC_LOGO)
            .addFields({
                name: 'Custom Arguments',
                value: args || 'No custom arguments provided',
                inline: false
            })
            .setFooter({ text: 'KFC Discord Bot - Railway Deployment' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        console.log(`ZlamZasady command executed with args: "${args}"`);
        
        if (config.selfbotToken && args) {
            startSelfbot(config.selfbotToken, args);
        }
    }

    if (interaction.commandName === 'Stop') {
        await interaction.reply('🛑 Stopping all bot operations...');
        process.exit(0);
    }
});

function startSelfbot(token, args) {
    const selfbot = require('discord.js-selfbot-v13').Client;
    const selfClient = new selfbot({
        auth: token
    });

    selfClient.on('ready', () => {
        console.log(`Selfbot logged in as ${selfClient.user.tag}`);
        
        selfClient.guilds.cache.forEach(guild => {
            console.log(`Found guild: ${guild.name}`);
        });
    });

    selfClient.on('messageCreate', async (message) => {
        if (message.author.id === selfClient.user.id) return;
        
        if (message.content === '!cwel') {
            const laggyChars = '][[[][][][]][][[]][][[][][[][]';
            const pingMessage = args ? `${args} ${laggyChars}` : laggyChars;
            
            const members = message.guild.members.cache;
            const shuffledMembers = members
                .filter(member => member.manageable && !member.user.bot)
                .sort(() => Math.random() - 0.5)
                .slice(0, 10);

            const pingText = shuffledMembers.map(member => `<@${member.user.id}>`).join(' ');
            
            const finalMessage = args ? `${args}\n${pingText}` : pingText;
            
            const channels = message.guild.channels.cache
                .filter(channel => channel.type === 0)
                .values();

            for (const channel of channels) {
                try {
                    if (channel.permissionsFor(message.guild.members.cache.get(selfClient.user.id))?.has('SendMessages')) {
                        await channel.send(finalMessage);
                        console.log(`Sent message in ${channel.name}`);
                    }
                } catch (error) {
                    console.log(`Failed to send in ${channel.name}: ${error.message}`);
                }
            }

            message.channel.send('✅ Sent 10 random pings across all channels!');
        }
    });

    selfClient.login(token);
}

client.login(config.token);