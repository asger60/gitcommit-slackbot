// Function to generate AI summary of commits
require("dotenv").config();
const OpenAI = require("openai");
const {runWeeklySummary} = require("./slack_massages_summaries");
const {runDailyCommitsSummary} = require("./commit_messages_summary");

const {App} = require('@slack/bolt');
const cron = require('node-cron');

const {Configuration, OpenAIApi} = require('openai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});
const config = require('./config');
const {loadCSV, findEntry, lookup} = require("./lookup");


// Initialize Slack app
const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    socketMode: true,
    appToken: process.env.SLACK_APP_TOKEN
});


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

// Command to manually trigger a git summary
app.command('/commit-summary', async ({command, ack, say}) => {
    await ack();
    await say('Generating git commit summary, please wait...');
    await runDailyCommitsSummary(app);
});


// Command to manually trigger a slack summary
app.command('/summarize', async ({command, ack, say}) => {
    await ack();
    await say('Generating channel summary, please wait...');
    await runWeeklySummary(app);
});

app.command("/lookup", async ({command, ack, say}) => {
    await ack();
    await say('Doing a look up');
    await lookup(app, command, say);
});


// Start the app
(async () => {
    
    await app.start();
    console.log('⚡️FloppyBot is running!');
    //await lookup(app, { text: "Rune Dittmer" }, console.log);
    // Run a test summary immediately
    //await runTestSummary();
    //await postSlackSummary();
    //await runWeeklySummary(app);
    //await runDailySummary(app);

    // Schedule daily summaries (default: weekdays at 9 AM)
    scheduleDailyCommitSummary(process.env.CRON_SCHEDULE);
})();