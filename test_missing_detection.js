import * as fs from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check for missing dialogues in a range (copied from copy_japanese_range.js)
const checkMissingDialogues = async (start, end) => {
    const regeneratedTxt = await fs.readFile(join(__dirname, "./regenerated.ain.txt"), "utf-8");
    const existingNumbers = new Set();
    
    // Get all dialogue numbers from English file
    const dialogueRegex = /^m\[(\d+)\]\s*=/gm;
    let match;
    
    while ((match = dialogueRegex.exec(regeneratedTxt)) !== null) {
        existingNumbers.add(parseInt(match[1]));
    }
    
    // Find missing numbers in range
    const missingNumbers = [];
    for (let i = start; i <= end; i++) {
        if (!existingNumbers.has(i)) {
            missingNumbers.push(i);
        }
    }
    
    if (missingNumbers.length > 0) {
        console.log(`⚠️  WARNING: Found ${missingNumbers.length} missing dialogues in range ${start}-${end}:`);
        console.log(`Missing numbers: ${missingNumbers.slice(0, 10).join(', ')}${missingNumbers.length > 10 ? '...' : ''}`);
        console.log("These dialogues will be added as new entries.\n");
    } else {
        console.log(`✅ All dialogues in range ${start}-${end} exist in English file.\n`);
    }
    
    return missingNumbers;
};

// Test the missing dialogue detection
const main = async () => {
    console.log("Testing missing dialogue detection...\n");
    
    // Test with a small range
    console.log("Testing range 1-10:");
    await checkMissingDialogues(1, 10);
    
    console.log("Testing range 100-110:");
    await checkMissingDialogues(100, 110);
    
    console.log("Testing range 1000-1010:");
    await checkMissingDialogues(1000, 1010);
    
    console.log("Missing dialogue detection test completed!");
    process.exit(0);
};

main().catch(error => {
    console.error("Error:", error);
    process.exit(1);
});
