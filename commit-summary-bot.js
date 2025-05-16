// Function to generate AI summary of commits
require("dotenv").config();
const OpenAI = require("openai");

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

async function generateAISummary(commits) {
    try {
        if (!process.env.OPENAI_API_KEY || commits.length === 0) {
            return null;
        }

        console.log("Generating AI summary for commits...");

        const commitData = commits.map(commit => ({
            author: commit.commit.author.name,
            message: commit.commit.message,
            date: commit.commit.author.date
        }));

        const prompt = `
Please summarize the following git commits from the repository:

${JSON.stringify(commitData, null, 2)}

Create a concise, human-readable summary that:
1. Identifies major features or changes
2. Groups related commits together
3. Highlights important bug fixes
4. Explains technical changes in plain language
5. Keeps it brief
`;

        const response = await openai.chat.completions.create({
            model: "gpt-4", // or "gpt-3.5-turbo"
            messages: [{role: "user", content: prompt}],
            temperature: 0.7,
        });

        const summary = response.choices[0].message.content.trim();
        console.log(summary);

        return summary;

    } catch (error) {
        console.error("Error generating AI summary:", error.message || error);
        return null;
    }
}

// commit-summary-bot.js
const {App} = require('@slack/bolt');
const axios = require('axios');
const cron = require('node-cron');
const {Configuration, OpenAIApi} = require('openai');
require('dotenv').config();

// Initialize Slack app
const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    socketMode: true,
    appToken: process.env.SLACK_APP_TOKEN
});

// Configuration
const config = {
    repoOwner: process.env.REPO_OWNER,         // GitHub username or organization
    repoName: process.env.REPO_NAME,           // Repository name
    slackChannel: process.env.SLACK_CHANNEL,   // Slack channel to post summaries
    githubToken: process.env.GITHUB_TOKEN,     // GitHub personal access token
    commitLookbackHours: process.env.LOOKBACK_HOURS ? parseInt(process.env.LOOKBACK_HOURS) : 24,  // How many hours of commits to include
    useAI: process.env.USE_AI === 'true',      // Whether to use AI for summaries
    openaiApiKey: process.env.OPENAI_API_KEY,   // OpenAI API key

    channelId: process.env.CHANNEL_ID,  // ID of the channel to monitor
    summaryDay: 'Sunday',               // Day to post the summary
    summaryTime: '18:00',               // Time to post the summary (24hr format)
    lookbackDays: 7,                    // Number of days to look back for messages
    maxMessages: 1000                   // Maximum number of messages to process
    
};

// Function to fetch commits from GitHub
async function fetchCommits() {
    try {
        // Calculate the date for lookback period
        const since = new Date();
        since.setHours(since.getHours() - config.commitLookbackHours);

        console.log(`Fetching commits from ${config.repoOwner}/${config.repoName} since ${since.toISOString()}`);

        const url = `https://api.github.com/repos/${config.repoOwner}/${config.repoName}/commits`;
        console.log(`API URL: ${url}`);

        const response = await axios.get(url, {
            headers: {
                'Authorization': `token ${config.githubToken}`,
                'Accept': 'application/vnd.github.v3+json'
            },
            params: {
                since: since.toISOString()
            }
        });

        console.log(`GitHub API Response Status: ${response.status}`);
        console.log(`Fetched ${response.data.length} commits`);

        return response.data;
    } catch (error) {
        console.error('Error fetching commits:', error.message);
        if (error.response) {
            console.error('Error details:', {
                status: error.response.status,
                data: error.response.data
            });
        }
        return [];
    }
}

// Function to generate commit summary
async function generateCommitSummary(commits) {
    if (commits.length === 0) {
        return "No commits were made in the last " + config.commitLookbackHours + " hours.";
    }

    // Group commits by author
    const commitsByAuthor = {};
    commits.forEach(commit => {
        const author = commit.commit.author.name;
        if (!commitsByAuthor[author]) {
            commitsByAuthor[author] = [];
        }
        commitsByAuthor[author].push({
            message: commit.commit.message,
            date: new Date(commit.commit.author.date).toLocaleString(),
            url: commit.html_url
        });
    });

    // Generate summary text
    let summary = `:rocket: *Daily Commit Summary for ${config.repoOwner}/${config.repoName}* :rocket:\n\n`;
    summary += `*Total commits in the last ${config.commitLookbackHours} hours:* ${commits.length}\n\n`;

    // Add AI summary if available
    if (config.useAI) {
        const aiSummary = await generateAISummary(commits);
        if (aiSummary) {
            summary += "*AI-Generated Summary:*\n";
            summary += aiSummary;
            summary += "\n\n*Detailed Commits:*\n";
        }
    }

    // Add details for each author
    Object.keys(commitsByAuthor).forEach(author => {
        const authorCommits = commitsByAuthor[author];
        summary += `*${author}* (${authorCommits.length} commits):\n`;

        authorCommits.forEach(commit => {
            // Take only the first line of commit message for brevity
            const shortMessage = commit.message.split('\n')[0];
            summary += `• <${commit.url}|${shortMessage}> (${commit.date})\n`;
        });

        summary += '\n';
    });

    return summary;
}

// Function to post summary to Slack
async function postCommitsSummaryToSlack(summary) {
    try {
        await app.client.chat.postMessage({
            channel: config.slackChannel,
            text: summary,
            mrkdwn: true
        });
        console.log('Daily commit summary posted to Slack');
    } catch (error) {
        console.error('Error posting to Slack:', error.message);
    }
}



// Schedule daily summary posting
function scheduleDailyCommitSummary(cronExpression = '0 9 * * 1-5') {
    console.log(`Scheduling daily summaries with cron expression: ${cronExpression}`);

    cron.schedule(cronExpression, async () => {
        console.log('Generating daily commit summary...');
        const commits = await fetchCommits();
        const summary = generateCommitSummary(commits);
        await postCommitsSummaryToSlack(summary);
    });
}

// Command to manually trigger a summary
app.command('/commit-summary', async ({command, ack, respond}) => {
    await ack();

    try {
        const commits = await fetchCommits();
        const summary = await generateCommitSummary(commits);
        console.log("fetched summary");

        await respond(summary);
    } catch (error) {
        await respond(`Error generating summary: ${error.message}`);
    }
});










// Function to get user info for mapping user IDs to names
async function getUserInfo(userId) {
    try {
        const result = await app.client.users.info({user: userId});
        return result.user?.real_name || result.user?.name || 'Unknown User';
    } catch (error) {
        console.error(`Error fetching user info for ID ${userId}:`, error);
        return 'Unknown User';
    }
}

async function fetchChannelMessagesWithUsernames(channelId, oldestTimestamp) {
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
                    userCache[msg.user] = await getUserInfo(msg.user);
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
async function prepareMessagesForSummary(messages) {
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
async function generateSummary(messages) {
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
async function postSummary(channelId, summary) {
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
async function runWeeklySummary() {
    console.log('Starting weekly summary process...');

    // Calculate timestamp for messages from the past week
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - (config.lookbackDays * 24 * 60 * 60 * 1000));
    const oldestTimestamp = oneWeekAgo.getTime() / 1000;

    // Fetch messages
//    const messages = await fetchChannelMessages(CONFIG.channelId, oldestTimestamp);
    const messages = await fetchChannelMessagesWithUsernames(config.channelId, oldestTimestamp);

    console.log(`Fetched ${messages.length} messages`);

    // Prepare messages for summary
    const formattedMessages = await prepareMessagesForSummary(messages);
    console.log(`Prepared ${formattedMessages.length} messages for summarization`);

    // Generate summary
    const summary = await generateSummary(formattedMessages);

    // Post summary to channel
    await postSummary(config.slackChannel, summary);
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

// Command to manually trigger a summary
app.command('/summarize', async ({command, ack, say}) => {
    await ack();
    await say('Generating channel summary, please wait...');
    await runWeeklySummary();
});














// Start the app
(async () => {
    await app.start();
    console.log('⚡️FloppyBot is running!');

    // Run a test summary immediately
    //await runTestSummary();
    //await postSlackSummary();

    // Schedule daily summaries (default: weekdays at 9 AM)
    scheduleDailyCommitSummary(process.env.CRON_SCHEDULE);
})();