const fs = require("fs");
const csv = require("csv-parser");
const Fuse = require("fuse.js");
const { google } = require("googleapis");

let entries = [];
let fuse;
const OpenAI = require("openai");
const config = require("./config");
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const keyJson = JSON.parse(
    Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_JSON, "base64").toString()
);

async function loadSheet() {
    const auth = new google.auth.GoogleAuth({
        credentials: JSON.parse(
            Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_JSON, "base64").toString()
        ),
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = "The list!A1:Z1000"; // or e.g. "Contacts!A1:Z1000"

    const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
        throw new Error("No data found in sheet");
    }

    const headers = rows[0];
    entries = rows.slice(1).map((row) => {
        const entry = {};
        headers.forEach((header, i) => {
            entry[header] = row[i] || "";
        });
        return entry;
    });

    fuse = new Fuse(entries, {
        keys: ["Company", "Person"],
        threshold: 0.3,
    });
}

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
    console.log('fetching google sheet ');
    
    await loadSheet();
    
    const name = command.text;
    say('looking up ' + name);
    console.log('looking up ' + name);
    
    const matches = findEntry(name);

    if (matches.length === 0) {
        say(`No match found for *${name}*.`);

        console.log(`No match found for *${name}*.`);
        
        return;
    }

    for (const entry of matches) {
        const base = `*${entry.Company || "Unknown Company"}* (${entry.Person || "Unknown Person"})
            • Ranking: ${entry.Ranking || "Unknown"}
            • Website: ${entry.Website || "Unknown"}
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
                            2. a quick search on ${entry.Website} about the types of investments types they make, or games they publish
                            
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
