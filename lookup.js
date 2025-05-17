const fs = require("fs");
const csv = require("csv-parser");
const Fuse = require("fuse.js");

let entries = [];
let fuse;
const OpenAI = require("openai");
const config = require("./config");
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});


async function loadCSV() {
    return new Promise((resolve) => {
        const results = [];
        fs.createReadStream("data.csv")
            .pipe(csv())
            .on("data", (data) => results.push(data))
            .on("end", () => {
                entries = results;
                fuse = new Fuse(entries, {
                    keys: ["Company", "Person"],
                    threshold: 0.3, // controls fuzziness: 0 = exact, 1 = very loose
                });
                resolve();
            });
    });
}

function findEntry(name) {
    if (!fuse || typeof name !== 'string' || name.trim() === '') {
        return [];
    }
    
    return fuse.search(name).map(result => result.item);
}

module.exports = {lookup};


async function lookup(app, command, say) {
    await loadCSV();
    const name = command.text;
    console.log('looking up ' + name);
    
    const matches = findEntry(name);

    if (matches.length === 0) {
        await say(`No match found for *${name}*.`);
        return;
    }

    for (const entry of matches) {
        const base = `*${entry.Company || "Unknown Company"}* (${entry.Person || "Unknown Person"})
• Ranking: ${entry.Ranking || "Unknown"}
• Last contacted: ${entry["Last contacted"] || "Unknown"}
• Notes: ${entry.Notes || "No notes"}`;

        //const enriched = "";
        const enriched = await enrichWithAI(entry);

        const summary = (`${base}\n\n🧠 *AI Insight:*\n${enriched}`);
        await postSummary(app, summary);
    }
}

async function postSummary(app, summary) {
    try {
        await app.client.chat.postMessage({
            channel: config.slackChannel,
            text: summary,
            mrkdwn: true
        });
        console.log('Lookup was posted to slack');
    } catch (error) {
        console.error('Error posting to Slack:', error.message);
    }
}

async function enrichWithAI(entry) {
    const prompt = `
                            You are an expert startup assistant. Based on the following notes, give:
                            1. A one-line company summary
                            2. a quick search on the internet about the person or company, what type of investments or publishing they normally do
                            
                            Notes:
                            ${entry.Notes || "No notes"}
                            Type: ${entry.Type || "Unknown"}
                            Status: ${entry.Status || "Unknown"}
                            `;

    const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{role: "user", content: prompt}],
    });

    return response.choices[0].message.content;
}
