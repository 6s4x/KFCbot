const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, GuildMemberManager, TextChannel } = require('discord.js');
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
            .setName('ZlamZasady')
            .setDescription('KFC User App Command - Initialize with custom args')
            .addStringOption(option =>
                option.setName('args')
                    .setDescription('Custom arguments for the bot')
                    .setRequired(false)
            ),
        new SlashCommandBuilder()
            .setName('Stop')
            .setDescription('Stop all KFC operations')
    ]).then(commands => {
        console.log(`✅ Synced ${commands.size} slash commands to your account`);
    }).catch(error => {
        console.log('⚠️  Command sync might need server admin permissions');
        console.log('Commands available but may not sync without permissions');
    });
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'ZlamZasady') {
        const args = interaction.options.getString('args') || '';

        try {
            const embed = new EmbedBuilder()
                .setColor('#FFB400')
                .setTitle('🍗 KFC User App - Activated!')
                .setDescription(KFC_LOGO)
                .addFields({
                    name: '📝 Custom Arguments',
                    value: args || 'None - Default mode',
                    inline: false
                })
                .setFooter({ text: 'KFC User App • User Install Application' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

            console.log(`⚔️ ZlamZasady command activated with args: "${args}"`);

            // Execute user actions if args provided
            if (args) {
                executeUserActions(interaction.channel, args);
            }
        } catch (error) {
            console.log(`❌ Error processing ZlamZasady: ${error.message}`);
            await interaction.reply('❌ Command failed - check permissions');
        }
    }

    if (interaction.commandName === 'Stop') {
        try {
            await interaction.reply('🛑 KFC User App stopping...');
            console.log('🛑 Stop command received');
            process.exit(0);
        } catch (error) {
            console.log('❌ Stop command failed');
        }
    }
});

function executeUserActions(message, args) {
    console.log('⚡ Executing user actions...');
    
    const laggyChars = '][[[][][][]][][[]][][[][][[][]';
    const pingMessage = args ? `${args} ${laggyChars}` : laggyChars;
    
    try {
        const members = message.guild.members.cache;
        const shuffledMembers = members
            .filter(member => member.manageable && !member.user.bot)
            .sort(() => Math.random() - 0.5)
            .slice(0, 10);

        const pingText = shuffledMembers.map(member => `<@${member.user.id}>`).join(' ');
        
        const finalMessage = args ? `${args}\n${pingText}` : pingText;
        
        const channels = message.guild.channels.cache
            .filter(channel => channel.type === 0 && channel.permissionsFor(message.client.user)?.has('SendMessages'))
            .values();

        for (const channel of channels) {
            try {
                await channel.send(finalMessage);
                console.log(`📨 Sent in ${channel.name}`);
            } catch (error) {
                console.log(`❌ Failed in ${channel.name}: ${error.message}`);
            }
        }

        message.channel.send('✅ KFC User Actions Completed!');
    } catch (error) {
        console.log(`❌ Error during user actions: ${error.message}`);
        message.channel.send('❌ Execution failed');
    }
}

client.login(config.token);