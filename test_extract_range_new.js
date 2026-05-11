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

// Updated extractRange function
const extractRange = (parsed, start, end) => {
    const result = [];
    let lastSpeaker = null;
    let processingRange = false;
    
    // Process all items to find the complete range including speaker for first dialogue
    for (let i = 0; i < parsed.length; i++) {
        const item = parsed[i];
        
        if (item.type === 'dialogue' && item.lineNumber >= start && item.lineNumber <= end) {
            if (!processingRange) {
                // This is the first dialogue in range, add the last speaker if we have one
                if (lastSpeaker !== null) {
                    result.push(lastSpeaker);
                }
                processingRange = true;
            }
            result.push(item.originalLine);
        } else if (item.type === 'dialogue' && item.lineNumber > end) {
            // We've passed the end of our range
            break;
        } else if (item.type === 'speaker') {
            // Always update the last speaker
            lastSpeaker = item.originalLine;
        }
    }
    
    return result.join('\n');
};

// Test the extractRange function
const main = async () => {
    console.log("Testing updated extractRange function...\n");
    
    // Create test data that matches the user's example
    const testData = `;s[4623] = "サーナキア／基本／真剣"
m[10] = "「ううむ……新しい兵法書が出ていたか。"
m[11] = "　読んでおかないと……」"

;s[4624] = "汎用ランス城騎士／盾なし"
m[12] = "「団長ー」"
m[13] = "ランス城騎士団の女の子がやって来た。"

;s[4622] = "サーナキア／基本"
m[14] = "「ん、どうかしたか？」"

;s[4624] = "汎用ランス城騎士／盾なし"
m[15] = "「表に鎧職人さんが来てるって。"`;

    const parsed = parseAinTxt(testData);
    
    console.log("Test 1: Range 10-15 (should include all dialogues with proper speakers)");
    const result1 = extractRange(parsed, 10, 15);
    console.log(result1);
    console.log("\n" + "=".repeat(50) + "\n");
    
    console.log("Test 2: Range 11-15 (should start with speaker for m[11] and include all dialogues)");
    const result2 = extractRange(parsed, 11, 15);
    console.log(result2);
    console.log("\n" + "=".repeat(50) + "\n");
    
    console.log("Test 3: Range 12-13 (should only include dialogues 12-13 with their speaker)");
    const result3 = extractRange(parsed, 12, 13);
    console.log(result3);
    console.log("\n" + "=".repeat(50) + "\n");
    
    console.log("Test 4: Range 14-15 (should include dialogues 14-15 with their respective speakers)");
    const result4 = extractRange(parsed, 14, 15);
    console.log(result4);
    
    console.log("\nTesting completed!");
    process.exit(0);
};

main().catch(error => {
    console.error("Error:", error);
    process.exit(1);
});
