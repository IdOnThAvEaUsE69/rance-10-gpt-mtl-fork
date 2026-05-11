import * as fs from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse ain.txt format to extract dialogue and speaker lines
const parseAinTxt = (text) => {
    const lines = text.split("\n");
    const result = [];
    
    for (const line of lines) {
        const trimmedLine = line.trim().replace(/\r$/, '');
        if (!trimmedLine) {
            result.push({ type: 'empty', line: trimmedLine });
            continue;
        }
        
        const speakerMatch = trimmedLine.match(/^;s\[(\d+)\]\s*=\s*(.*)$/);
        if (speakerMatch) {
            const [, lineNumber, quotedText] = speakerMatch;
            result.push({ type: 'speaker', lineNumber: +lineNumber, quotedText, originalLine: trimmedLine });
            continue;
        }
        
        const dialogueMatch = trimmedLine.match(/^m\[(\d+)\]\s*=\s*(.*)$/);
        if (dialogueMatch) {
            const [, lineNumber, quotedText] = dialogueMatch;
            result.push({ type: 'dialogue', lineNumber: +lineNumber, quotedText, originalLine: trimmedLine });
            continue;
        }
        
        result.push({ type: 'other', line: trimmedLine });
    }
    
    return result;
};

// Extract dialogues and speakers within a range
const extractRange = (parsed, start, end) => {
    const result = [];
    let currentSpeakerName = null;
    let index = 1;
    
    console.log(`Processing range ${start}-${end}:`);
    console.log("First 20 items in parsed array:");
    for (let i = 0; i < Math.min(20, parsed.length); i++) {
        const item = parsed[i];
        console.log(`${i}: type=${item.type}, lineNumber=${item.lineNumber}, original="${item.originalLine}"`);
    }
    console.log("\n--- Starting extraction ---\n");
    
    for (const item of parsed) {
        if (item.type === 'speaker') {
            // Extract speaker name from ;s[xxx] = "Speaker Name"
            const speakerMatch = item.originalLine.match(/^;s\[(\d+)\]\s*=\s*"(.*)"$/);
            if (speakerMatch) {
                currentSpeakerName = speakerMatch[1];
                console.log(`Set current speaker to: ${currentSpeakerName}`);
            }
        } else if (item.type === 'dialogue' && item.lineNumber >= start && item.lineNumber <= end) {
            // Extract dialogue content from m[xxx] = "dialogue"
            const dialogueMatch = item.originalLine.match(/^m\[(\d+)\]\s*=\s*"(.*)"$/);
            const dialogueContent = dialogueMatch ? dialogueMatch[1] : item.originalLine;
            
            console.log(`Processing dialogue m[${item.lineNumber}]: "${dialogueContent}" with speaker: ${currentSpeakerName}`);
            
            if (currentSpeakerName !== null) {
                result.push(`${index}. "${currentSpeakerName}": "${dialogueContent}"`);
                console.log(`Output ${index}: "${currentSpeakerName}": "${dialogueContent}"`);
                index++;
            } else {
                result.push(`${index}. "${dialogueContent}"`);
                console.log(`Output ${index}: "${dialogueContent}"`);
                index++;
            }
        }
    }
    
    return result.join('\n');
};

// Main
const main = async () => {
    console.log("Loading regenerated_japanese.ain.txt...");
    const text = await fs.readFile(join(__dirname, "./regenerated_japanese.ain.txt"), "utf-8");
    const parsed = parseAinTxt(text);
    console.log("Loaded. Testing extractRange function.\n");
    
    // Test with range 1-100
    const start = 1;
    const end = 100;
    
    const extracted = extractRange(parsed, start, end);
    
    console.log("\n=== EXTRACTED OUTPUT ===");
    console.log(extracted);
    console.log("=== END OUTPUT ===\n");
    
    process.exit(0);
};

main().catch(error => {
    console.error("Error:", error);
    process.exit(1);
});
