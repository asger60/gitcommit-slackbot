require('dotenv').config();

// Configuration
const config = {
    repoOwner: process.env.REPO_OWNER,         // GitHub username or organization
    repoName: process.env.REPO_NAME,           // Repository name
    slackChannel: process.env.BOT_CHANNEL,   // Slack channel to post summaries
    githubToken: process.env.GITHUB_TOKEN,     // GitHub personal access token
    commitLookbackHours: process.env.LOOKBACK_HOURS ? parseInt(process.env.LOOKBACK_HOURS) : 24,  // How many hours of commits to include
    useAI: process.env.USE_AI === 'true',      // Whether to use AI for summaries
    openaiApiKey: process.env.OPENAI_API_KEY,   // OpenAI API key

    channelId: process.env.SUMMARY_CHANNEL,  // ID of the channel to monitor
    summaryDay: 'Sunday',               // Day to post the summary
    summaryTime: '18:00',               // Time to post the summary (24hr format)
    lookbackDays: 7,                    // Number of days to look back for messages
    maxMessages: 1000                   // Maximum number of messages to process
};

module.exports = config;