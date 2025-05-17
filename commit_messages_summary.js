const config = require("./config");
const axios = require("axios");
const OpenAI = require("openai");
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

module.exports = {
    runDailyCommitsSummary,
};

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
async function postSummary(app, summary) {
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

async function runDailyCommitsSummary(app) {
    console.log('Starting daily git summary process...');
    const commits = await fetchCommits();
    const summary = await generateCommitSummary(commits);
    console.log("fetched summary");
    await postSummary(app, summary);
}