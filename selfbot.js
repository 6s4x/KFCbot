const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const selfClient = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const config = {
    token: process.env.SELFBOT_TOKEN,
    ownerId: process.env.OWNER_ID
};

selfClient.once('ready', () => {
    console.log(`Selfbot logged in as ${selfClient.user.tag}`);
    console.log('Ready to execute commands!');
});

selfClient.on('ready', () => {
    selfClient.guilds.cache.forEach(guild => {
        console.log(`Connected to guild: ${guild.name}`);
        console.log(`Members: ${guild.memberCount}`);
    });
});

selfClient.on('messageCreate', async (message) => {
    if (message.author.id !== selfClient.user.id) return;
    
    if (message.content === '!cwel') {
        console.log('Executing !cwel command...');
        
        const laggyChars = '][[[][][][]][][[]][][[][][[][]';
        
        message.guild.members.cache.forEach(member => {
            if (member.manageable && !member.user.bot) {
                console.log(`Scanning member: ${member.user.tag}`);
            }
        });

        const channels = message.guild.channels.cache
            .filter(channel => channel.type === 0)
            .values();

        for (const channel of channels) {
            try {
                if (channel.permissionsFor(message.guild.members.cache.get(selfClient.user.id))?.has('SendMessages')) {
                    const pingText = laggyChars;
                    await channel.send(pingText);
                    console.log(`✅ Sent in ${channel.name}`);
                }
            } catch (error) {
                console.log(`❌ Failed in ${channel.name}: ${error.message}`);
            }
        }

        console.log('✅ All channels processed');
    }
});

selfClient.on('messageCreate', async (message) => {
    if (message.author.id !== selfClient.user.id) return;
    
    if (message.content === '!cwel with args') {
        const args = 'Custom arguments here';
        const pingText = `${args} ${laggyChars}`;
        
        const shuffledMembers = message.guild.members.cache
            .filter(member => member.manageable && !member.user.bot)
            .sort(() => Math.random() - 0.5)
            .slice(0, 10);

        const pingTextWithMentions = shuffledMembers.map(member => `<@${member.user.id}>`).join(' ');
        const finalMessage = `${args}\n${pingTextWithMentions}`;

        const channels = message.guild.channels.cache
            .filter(channel => channel.type === 0)
            .values();

        for (const channel of channels) {
            try {
                if (channel.permissionsFor(message.guild.members.cache.get(selfClient.user.id))?.has('SendMessages')) {
                    await channel.send(finalMessage);
                    console.log(`✅ Sent in ${channel.name}`);
                }
            } catch (error) {
                console.log(`❌ Failed in ${channel.name}: ${error.message}`);
            }
        }

        console.log('✅ All channels processed with args');
    }
});

selfClient.login(config.token);