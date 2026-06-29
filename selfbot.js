const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const config = {
    token: process.env.SELFBOT_TOKEN,
    args: '', // Default args, will be set when selfbot is activated
    ownerId: process.env.OWNER_ID
};

client.once('ready', () => {
    console.log(`🔧 Selfbot logged in as ${client.user.tag}`);
    console.log('⚔️ Selfbot ready for slash command execution!');
    console.log('✅ Selfbot initialized successfully');
});

client.on('ready', async () => {
    console.log('Command monitoring initialized...');

    // Get all servers and channels
    client.guilds.cache.forEach(guild => {
        console.log(`✅ Connected to guild: ${guild.name}`);
        console.log(`👥 Members: ${guild.memberCount}`);
        
        const textChannels = guild.channels.cache.filter(channel => channel.type === 0).size;
        console.log(`💬 Text channels: ${textChannels}`);
    });
});

client.on('messageCreate', async (message) => {
    if (message.author.id !== client.user.id) return;
    
    // Selfbot executes /cwel functionality when triggered
    if (message.content.includes('/cwel') || message.content.includes('trigger_selfbot')) {
        console.log('⚡ Selfbot executing /cwel command...');
        
        const laggyChars = '][[[][][][]][][[]][][[][][[][]';
        const args = config.args || '';
        const finalContent = args ? `${args}\n${laggyChars}` : laggyChars;

        try {
            // Get all text channels from all servers
            const allTextChannels = [];
            client.guilds.cache.forEach(guild => {
                const channels = guild.channels.cache.filter(channel => 
                    channel.type === 0 && channel.permissionsFor(client.user)?.has('SendMessages')
                );
                channels.forEach(channel => allTextChannels.push({
                    channel: channel,
                    guild: guild
                }));
            });

            if (allTextChannels.length === 0) {
                console.log('❌ No text channels available');
                return;
            }

            console.log(`🚀 Sending 5 reply chains across ${allTextChannels.length} channels...`);

            // Send 5 reply chains (rotating through all channels)
            let channelIndex = 0;
            const maxReplies = 5;
            const allChannels = Array.from(allTextChannels);

            const sendReplyChain = async (replyIndex) => {
                if (replyIndex >= maxReplies) {
                    console.log('✅ All 5 reply chains completed!');
                    
                    // Acknowledge completion
                    const firstChannel = allChannels[0]?.channel;
                    if (firstChannel && firstChannel.permissionsFor(client.user)?.has('SendMessages')) {
                        await firstChannel.send('✅ Selfbot: 5 /cwel reply chains sent!');
                    }
                    return;
                }

                try {
                    const currentChannelData = allChannels[channelIndex % allChannels.length];
                    const currentChannel = currentChannelData.channel;
                    const guild = currentChannelData.guild;

                    if (!currentChannel) {
                        console.log(`❌ Channel ${channelIndex} not found`);
                        channelIndex++;
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        await sendReplyChain(replyIndex);
                        return;
                    }

                    // Get shuffled members from the current guild
                    const shuffledMembers = guild.members.cache
                        .filter(member => member.manageable && !member.user.bot)
                        .sort(() => Math.random() - 0.5)
                        .slice(0, 10);

                    // Create ping text
                    const pingText = shuffledMembers.map(member => `<@${member.user.id}>`).join(' ');
                    
                    // Create final content with args
                    const finalContent = args ? `${args}\n${pingText}` : laggyChars;

                    // Send the message with reply to previous message
                    if (currentChannel.permissionsFor(client.user)?.has('SendMessages')) {
                        await currentChannel.send({
                            content: finalContent,
                            reply: { messageReference: message.id, failIfNotExists: false }
                        });
                        console.log(`📨 Selfbot chain ${replyIndex + 1}/5 sent in #${currentChannel.name} in ${guild.name}`);
                    }

                    // Move to next channel
                    channelIndex++;
                    
                    // Add 1 second delay between chains
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    // Continue to next reply
                    await sendReplyChain(replyIndex + 1);

                } catch (error) {
                    console.log(`❌ Chain ${replyIndex + 1} failed: ${error.message}`);
                    channelIndex++;
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    await sendReplyChain(replyIndex + 1);
                }
            };

            // Start the reply chain
            await sendReplyChain(0);

        } catch (error) {
            console.log(`❌ Error executing /cwel: ${error.message}`);
            const firstChannel = allChannels[0]?.channel;
            if (firstChannel && firstChannel.permissionsFor(client.user)?.has('SendMessages')) {
                await firstChannel.send('❌ Selfbot execution failed');
            }
        }
    }
});

client.on('ready', () => {
    client.guilds.cache.forEach(guild => {
        console.log(`🛠️ Server detected: ${guild.name} | ID: ${guild.id}`);
    });
});

client.login(config.token);