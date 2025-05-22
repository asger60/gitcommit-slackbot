const config = require('./config');
const OpenAI = require("openai");

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

module.exports = {
    runWeeklySummary,
};

// Function to get user info for mapping user IDs to names
const cron = require("node-cron");

async function getUserInfo(app, userId) {
    try {
        const result = await app.client.users.info({user: userId});
        return result.user?.real_name || result.user?.name || 'Unknown User';
    } catch (error) {
        console.error(`Error fetching user info for ID ${userId}:`, error);
        return 'Unknown User';
    }
}

async function fetchChannelMessagesWithUsernames(app, channelId, oldestTimestamp) {
    let allMessages = [];
    let cursor;
    const userCache = {};

    try {
        do {
            const response = await app.client.conversations.history({
                channel: channelId,
                limit: 100,
                cursor: cursor,
                oldest: oldestTimestamp
            });

            const messages = response.messages.filter(msg => !msg.bot_id && !msg.subtype);

            // Resolve usernames
            const resolved = await Promise.all(messages.map(async msg => {
                if (!msg.user) return msg;
                if (!userCache[msg.user]) {
                    userCache[msg.user] = await getUserInfo(app, msg.user);
                }
                return {
                    ...msg,
                    username: userCache[msg.user]
                };
            }));

            allMessages = [...allMessages, ...resolved];
            cursor = response.response_metadata?.next_cursor;

            if (allMessages.length >= config.maxMessages) break;

        } while (cursor);

        return allMessages;
    } catch (error) {
        console.error('Error fetching channel messages:', error);
        return [];
    }
}

// Function to prepare messages for summarization
async function prepareMessagesForSummary(app, messages) {
    const userCache = {};

    const formattedMessages = [];

    for (const message of messages) {
        // Skip thread replies for now - can be modified to include threads if needed
        if (message.thread_ts && message.thread_ts !== message.ts) continue;

        try {
            // Get user info if not already cached
            if (!userCache[message.user]) {
                const userInfo = await app.client.users.info({user: message.user});
                userCache[message.user] = userInfo.user;
            }

            const user = userCache[message.user];
            const userName = user.profile.real_name || user.profile.display_name || user.name || message.user;
            const timestamp = new Date(parseInt(message.ts.split('.')[0]) * 1000).toISOString();

            formattedMessages.push({
                user: userName,
                text: message.text,
                timestamp
            });
        } catch (error) {
            console.error(`Error processing message from user ${message.user}:`, error);
            formattedMessages.push({
                user: message.user,
                text: message.text,
                timestamp: new Date(parseInt(message.ts.split('.')[0]) * 1000).toISOString()
            });
        }
    }

    return formattedMessages;
}

// Function to generate a summary using OpenAI
async function generateSummary( messages) {
    if (messages.length === 0) {
        return "No messages to summarize this week.";
    }

    try {
        const messageText = messages.map(msg =>
            `[${msg.timestamp}] ${msg.username}: ${msg.text}`
        ).join('\n');

        const response = await openai.chat.completions.create({
            model: "gpt-4-turbo",
            messages: [
                {
                    role: "system",
                    content: "You are a newsletter author writing about the ongoing business of our games studio Floppy Club. " +
                        "Create a concise summary of the following Slack messages from the past week. " +
                        "Focus on key topics, decisions, and questions. " +
                        "Group related discussions together and highlight important information. " +
                        "Write in fluid language, that is easy to understand, with little superlatives. "

                    //content: "You are a helpful assistant that summarizes Slack conversations. " +
                    //    "Create a concise summary of the following Slack messages from the past week. " +
                    //    "Focus on key topics, decisions, questions, and action items. " +
                    //    "Group related discussions together and highlight important information. " +
                    //    "Format the summary in Slack markdown with clear sections." 

                },
                {
                    role: "user",
                    content: `Please summarize these Slack messages from the past week:\n\n${messageText}`
                }
            ],
            max_tokens: 1500
        });

        return response.choices[0].message.content;
    } catch (error) {
        console.error('Error generating summary:', error);
        return "An error occurred while generating the summary.";
    }
}

// Function to post the summary to the channel
async function postSummary(app, channelId, summary) {
    try {
        await app.client.chat.postMessage({
            channel: channelId,
            text: `*Weekly Channel Summary*\n\n${summary}`
        });
        console.log('Posted weekly summary successfully');
    } catch (error) {
        console.error('Error posting summary:', error);
    }
}

// Main function to run the weekly summary process
async function runWeeklySummary(app) {
    console.log('Starting weekly summary process...');

    // Calculate timestamp for messages from the past week
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - (config.lookbackDays * 24 * 60 * 60 * 1000));
    const oldestTimestamp = oneWeekAgo.getTime() / 1000;

    // Fetch messages
//    const messages = await fetchChannelMessages(CONFIG.channelId, oldestTimestamp);
    console.log(`Fetching messages from ${config.channelId} since ${oldestTimestamp}`);
    const messages = await fetchChannelMessagesWithUsernames(app, config.channelId, oldestTimestamp);

    console.log(`Fetched ${messages.length} messages`);

    // Prepare messages for summary
    const formattedMessages = await prepareMessagesForSummary(app, messages);
    console.log(`Prepared ${formattedMessages.length} messages for summarization`);

    // Generate summary
    const summary = await generateSummary( formattedMessages);

    // Post summary to channel
    await postSummary(app, config.slackChannel, summary);
}

// Schedule the weekly summary
// Cron format: minute hour day-of-month month day-of-week
// Schedule based on CONFIG.summaryDay and CONFIG.summaryTime
const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const dayNumber = weekdays.indexOf(config.summaryDay);
const [hour, minute] = config.summaryTime.split(':');

const cronSchedule = `${minute} ${hour} * * ${dayNumber}`;
console.log(`Scheduled weekly summary for ${config.summaryDay} at ${config.summaryTime} (cron: ${cronSchedule})`);

cron.schedule(cronSchedule, runWeeklySummary);


