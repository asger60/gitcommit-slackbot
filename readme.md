Slack Commit Summary Bot
A Slack bot that automatically generates daily summaries of commits from a GitHub repository and posts them to a specified Slack channel.

Features
📊 Daily summaries of repository commits
👥 Commits grouped by author
🔗 Direct links to each commit
⏰ Configurable schedule using cron expressions
🤖 Manual trigger via Slack command (/commit-summary)
Setup Instructions
Prerequisites
Node.js (v14 or later)
npm (v6 or later)
A Slack workspace with admin permissions
A GitHub repository to monitor
Step 1: Create a Slack App
Go to https://api.slack.com/apps
Click "Create New App" and select "From scratch"
Name your app (e.g., "Commit Summary Bot") and select your workspace
Under "Basic Information", note your Signing Secret
Navigate to "Socket Mode" and enable it. Generate and note your App-Level Token
Go to "OAuth & Permissions" and add the following Bot Token Scopes:
chat:write
commands
Install the app to your workspace and note the Bot User OAuth Token
Under "Slash Commands", create a new command called /commit-summary
Request URL: No need to set this when using Socket Mode
Short Description: "Generate a summary of recent commits"
Usage Hint: "(optional)"
Step 2: Set Up GitHub Access
Create a Personal Access Token on GitHub
Go to GitHub Settings > Developer Settings > Personal Access Tokens
Create a new token with the repo scope (for private repos) or public_repo (for public repos)
Copy the token for later use
Step 3: Configure and Run the Bot
Clone this repository:
bash
git clone https://github.com/yourusername/slack-commit-summary-bot.git
cd slack-commit-summary-bot
Install dependencies:
bash
npm install
Create a .env file in the project root with your configuration:
# Slack Credentials
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_SIGNING_SECRET=your-signing-secret-here
SLACK_APP_TOKEN=xapp-your-app-token-here
SLACK_CHANNEL=C012345ABCDE  # or channel name like #dev-updates

# GitHub Repository Configuration
REPO_OWNER=your-github-username-or-org
REPO_NAME=your-repository-name
GITHUB_TOKEN=ghp_your-github-personal-access-token

# Schedule Configuration (Cron format)
# Default: Every weekday at 9 AM
CRON_SCHEDULE=0 9 * * 1-5
Start the bot:
bash
npm start
Usage
The bot will automatically post commit summaries to the configured Slack channel based on the schedule defined in your .env file.

You can also manually trigger a summary by using the /commit-summary slash command in any channel where the bot is present.

Customization
You can customize the lookback period by modifying the commitLookbackHours value in the config object in commit-summary-bot.js.

The scheduling is controlled by the CRON_SCHEDULE environment variable, which uses standard cron syntax:

Default (0 9 * * 1-5): Monday to Friday at 9:00 AM
For daily at midnight: 0 0 * * *
For every 12 hours: 0 */12 * * *
License
MIT

