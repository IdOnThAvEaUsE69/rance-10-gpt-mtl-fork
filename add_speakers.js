import * as fs from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse Rance10.v1.04.ain.txt to build speaker mapping
const parseSpeakerMapping = (text) => {
    const lines = text.split("\n");
    const speakerMap = new Map(); // speakerId -> Japanese name
    const messageToSpeaker = new Map(); // lineNumber -> speakerId
    
    let currentSpeakerId = null;
    
    for (const line of lines) {
        const trimmedLine = line.trim().replace(/\r$/, '');
        if (!trimmedLine) continue;
        
        // Parse speaker line: ;s[4629] = "ランス／基本"
        const speakerMatch = trimmedLine.match(/^;s\[(\d+)\]\s*=\s*"(.*)"$/);
        if (speakerMatch) {
            const [, speakerId, japaneseName] = speakerMatch;
            // Extract just the name part before "／" (slash)
            const namePart = japaneseName.split("／")[0];
            speakerMap.set(+speakerId, namePart);
            currentSpeakerId = +speakerId;
            continue;
        }
        
        // Parse message line: ;m[129158] = "..."
        const messageMatch = trimmedLine.match(/^;m\[(\d+)\]/);
        if (messageMatch) {
            const [, lineNumber] = messageMatch;
            if (currentSpeakerId !== null) {
                messageToSpeaker.set(+lineNumber, currentSpeakerId);
            }
        }
    }
    
    return { speakerMap, messageToSpeaker };
};

// Translate Japanese name to English
const translateName = (japaneseName, mistranslatedNames) => {
    for (const nameRecord of mistranslatedNames) {
        if (nameRecord.shortNameJpn === japaneseName) {
            return nameRecord.shortNameEng;
        }
    }
    // If not found, return original Japanese name
    return japaneseName;
};

// Parse regenerated.ain.txt
const parseRegenerated = (text) => {
    const lines = text.split("\n");
    const parsed = [];
    for (const line of lines) {
        const trimmedLine = line.trim().replace(/\r$/, '');
        if (!trimmedLine) continue;
        const match = trimmedLine.match(/^m\[(\d+)\]\s*=\s*(.*)$/);
        if (match) {
            const [, lineNumber, quotedText] = match;
            parsed.push({ lineNumber: +lineNumber, line: trimmedLine });
        }
    }
    return parsed;
};

// Read files
const v104AinTxt = await fs.readFile(join(__dirname, "./Rance10.v1.04.ain.txt"), "utf-8");
const regeneratedTxt = await fs.readFile(join(__dirname, "./regenerated.ain.txt"), "utf-8");
const mistranslatedNamesStr = await fs.readFile(join(__dirname, "./mistranslated_names.json"), "utf-8");
const mistranslatedNames = JSON.parse(mistranslatedNamesStr);

// Build speaker mapping
const { speakerMap, messageToSpeaker } = parseSpeakerMapping(v104AinTxt);
console.log(`Found ${speakerMap.size} unique speakers`);
console.log(`Found ${messageToSpeaker.size} messages with speakers`);

// Parse regenerated file
const regeneratedLines = parseRegenerated(regeneratedTxt);
console.log(`Total lines in regenerated: ${regeneratedLines.length}`);

// Add speakers to regenerated lines
const output = [];
let lastSpeaker = null;

for (const { lineNumber, line } of regeneratedLines) {
    const speakerId = messageToSpeaker.get(lineNumber);
    
    if (speakerId !== undefined) {
        const japaneseName = speakerMap.get(speakerId);
        const englishName = translateName(japaneseName, mistranslatedNames);
        
        // Only add speaker line if speaker changed
        if (lastSpeaker !== englishName) {
            // Add newline if speaker changed (except for first speaker)
            if (lastSpeaker !== null) {
                output.push("");
            }
            output.push(`;s[${speakerId}] = "${englishName}"`);
            lastSpeaker = englishName;
        }
    } else {
        // No speaker for this line, reset lastSpeaker
        lastSpeaker = null;
    }
    
    output.push(line);
}

// Write output
const outputText = output.join("\n") + "\n";
await fs.writeFile(join(__dirname, "./regenerated.ain.txt"), outputText, "utf-8");

console.log("\nDone! Added speakers to regenerated.ain.txt");
