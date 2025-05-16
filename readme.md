Slack Commit Summary Bot

A Slack bot that provides summaries of GitHub commits and recent messages in a Slack channel. Automatically posts summaries on a schedule or via a slash command.

✨ Features

🧠 AI-generated summaries of GitHub commits
💬 AI-generated summaries of recent Slack channel messages
👥 Commits grouped by author with direct links
⏰ Scheduled posting using cron syntax
🤖 Manual trigger with /commit-summary slash command
🛠 Setup Instructions

Prerequisites
Node.js (v14 or later)
A Slack workspace (admin access)
A GitHub repo to track
An OpenAI API key
1. Create a Slack App
Go to Slack API: Create App
Choose "From scratch"
Enable Socket Mode
Add the following OAuth Scopes:
chat:write
commands
Create a Slash Command: /commit-summary
Install the app and note:
Bot Token
Signing Secret
App-Level Token
2. Set Up GitHub Access
Create a Personal Access Token on GitHub:
Scope: repo (private) or public_repo (public)
Copy the token for use in your .env file
3. Configure Environment
Create a .env file in the root folder with:

# Slack Configuration
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_APP_TOKEN=xapp-your-app-token
SLACK_CHANNEL=#your-channel-name

# GitHub Repo Info
REPO_OWNER=your-github-username
REPO_NAME=your-repo
GITHUB_TOKEN=your-github-token

# OpenAI
OPENAI_API_KEY=your-openai-key
USE_AI=true

# Schedule (cron format, default: 9 AM weekdays)
CRON_SCHEDULE=0 9 * * 1-5

# Optional
COMMIT_LOOKBACK_HOURS=24
MESSAGE_LOOKBACK_HOURS=12
4. Install & Run
npm install
npm start
💡 Usage

Scheduled commit summaries are posted automatically to the specified Slack channel.
Use /commit-summary in any channel where the bot is present to trigger a summary manually.
Includes summaries of recent Slack messages and recent GitHub commits.
🔧 Customization

Adjust lookback hours via .env:
COMMIT_LOOKBACK_HOURS
MESSAGE_LOOKBACK_HOURS
Customize cron schedule with CRON_SCHEDULE
📜 License

MIT
