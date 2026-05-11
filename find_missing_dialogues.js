import * as fs from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get all dialogue numbers from text using regex
const getDialogueNumbers = (text) => {
    const dialogueRegex = /^m\[(\d+)\]\s*=/gm;
    const numbers = new Set();
    let match;
    
    while ((match = dialogueRegex.exec(text)) !== null) {
        numbers.add(parseInt(match[1]));
    }
    
    return numbers;
};

// Extract specific dialogue lines from Japanese text
const extractDialoguesByNumbers = (japaneseText, lineNumbers) => {
    const lines = japaneseText.split('\n');
    const numberSet = new Set(lineNumbers);
    const result = [];
    
    for (const line of lines) {
        const trimmedLine = line.trim().replace(/\r$/, '');
        const dialogueMatch = trimmedLine.match(/^m\[(\d+)\]\s*=\s*(.*)$/);
        
        if (dialogueMatch) {
            const lineNumber = parseInt(dialogueMatch[1]);
            if (numberSet.has(lineNumber)) {
                result.push(trimmedLine);
            }
        }
    }
    
    return result.join('\n');
};

// Main
const main = async () => {
    console.log("Loading English regenerated.ain.txt...");
    const englishText = await fs.readFile(join(__dirname, "./regenerated.ain copy.txt"), "utf-8");
    
    console.log("Loading Japanese regenerated_japanese.ain.txt...");
    const japaneseText = await fs.readFile(join(__dirname, "./regenerated_japanese.ain.txt"), "utf-8");
    
    console.log("Finding dialogue numbers...");
    const englishNumbers = getDialogueNumbers(englishText);
    const maxEnglishNumber = 269677;
    console.log(`English file has dialogues up to m[${maxEnglishNumber}]`);
    
    // Find missing dialogues by checking which numbers from 1 to max are not in English
    const missingNumbers = [];
    for (let i = 1; i <= maxEnglishNumber; i++) {
        if (!englishNumbers.has(i)) {
            missingNumbers.push(i);
        }
    }
    
    console.log(`Found ${missingNumbers.length} missing dialogues`);
    
    if (missingNumbers.length === 0) {
        console.log("No missing dialogues found.");
        process.exit(0);
    }
    
    // Extract Japanese dialogues for missing numbers
    const missingJapaneseDialogues = extractDialoguesByNumbers(japaneseText, missingNumbers);
    
    if (!missingJapaneseDialogues.trim()) {
        console.log("No Japanese dialogues found for missing numbers.");
        process.exit(0);
    }
    
    console.log("Writing missing dialogues to missing_dialogues.ain.txt...");
    
    // Write to missing_dialogues.ain.txt
    await fs.writeFile(join(__dirname, "./missing_dialogues.ain.txt"), missingJapaneseDialogues, "utf-8");
    
    console.log(`Successfully wrote ${missingNumbers.length} missing dialogues to missing_dialogues.ain.txt`);
    console.log(`Missing dialogue numbers: ${missingNumbers.slice(0, 20).join(', ')}${missingNumbers.length > 20 ? '...' : ''}`);
    
    process.exit(0);
};

main().catch(error => {
    console.error("Error:", error);
    process.exit(1);
});
