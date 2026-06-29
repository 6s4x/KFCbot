const axios = require('axios');
require('dotenv').config();

const config = {
    token: process.env.SELFBOT_TOKEN,
    guildId: process.argv[2] || null, // Optional: specify guild ID
    args: process.argv.slice(3).join(' ') || ''
};

let running = true;

async function api(method, endpoint, data = null) {
    try {
        const response = await axios({
            method,
            url: `https://discord.com/api/v10${endpoint}`,
            headers: {
                'Authorization': config.token,
                'Content-Type': 'application/json'
            },
            data
        });
        return response.data;
    } catch (error) {
        console.log(`❌ API error: ${error.message}`);
        return null;
    }
}

async function main() {
    const user = await api('GET', '/users/@me');
    if (!user) {
        console.log('❌ Failed to authenticate selfbot - check SELFBOT_TOKEN');
        process.exit(1);
    }

    console.log(`🔐 Selfbot logged in as ${user.username}#${user.discriminator}`);

    const guilds = await api('GET', '/users/@me/guilds');
    if (!guilds || guilds.length === 0) {
        console.log('❌ Selfbot is not in any guilds');
        return;
    }

    // Filter to specific guild if specified
    const targetGuilds = config.guildId
        ? guilds.filter(g => g.id === config.guildId)
        : guilds;

    console.log(`✅ Selfbot in ${targetGuilds.length} guilds`);
    console.log('🔄 Selfbot running - press Ctrl+C to stop');

    const laggyChars = '][[[][][][]][][[]][][[][][[][]';

    while (running) {
        for (const guild of targetGuilds) {
            if (!running) break;

            const [channels, members] = await Promise.all([
                api('GET', `/guilds/${guild.id}/channels`),
                api('GET', `/guilds/${guild.id}/members?limit=1000`)
            ]);

            if (!channels || !members) continue;

            const textChannels = channels.filter(ch => ch.type === 0);
            const nonBotMembers = members.filter(m => !m.user.bot);

            if (textChannels.length === 0) {
                console.log(`⏭️ ${guild.name}: No text channels`);
                continue;
            }

            console.log(`📋 ${guild.name}: ${textChannels.length} channels, ${nonBotMembers.length} members`);

            for (const channel of textChannels) {
                if (!running) break;

                let lastMessageId = null;

                for (let i = 0; i < 5; i++) {
                    if (!running) break;

                    const shuffled = nonBotMembers.sort(() => Math.random() - 0.5).slice(0, 10);
                    const pings = shuffled.map(m => `<@${m.user.id}>`).join(' ');
                    const content = config.args ? `${config.args} ${pings}` : `${laggyChars} ${pings}`;

                    const payload = { content };
                    if (lastMessageId) {
                        payload.message_reference = { message_id: lastMessageId, fail_if_not_exists: false };
                    }

                    const result = await api('POST', `/channels/${channel.id}/messages`, payload);
                    if (result) {
                        lastMessageId = result.id;
                        console.log(`📨 Chain ${i+1}/5 in #${channel.name}`);
                    }

                    await new Promise(resolve => setTimeout(resolve, 1500));
                }
            }
        }
    }

    console.log('🛑 Selfbot stopped');
}

main();

process.on('SIGINT', () => {
    running = false;
    console.log('\n🛑 Stopping selfbot...');
});