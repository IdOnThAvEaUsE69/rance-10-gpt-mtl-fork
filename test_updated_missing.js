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

// Check for missing dialogues in user's provided translations
const checkMissingDialogues = async (start, end, clipboardContent) => {
    // Load Japanese source to get expected dialogues in range
    const japaneseText = await fs.readFile(join(__dirname, "./regenerated_japanese.ain.txt"), "utf-8");
    const japaneseParsed = parseAinTxt(japaneseText);
    
    // Get expected dialogues from Japanese source in range
    const expectedDialogues = [];
    for (const item of japaneseParsed) {
        if (item.type === 'dialogue' && item.lineNumber >= start && item.lineNumber <= end) {
            expectedDialogues.push(item.lineNumber);
        }
    }
    
    // Parse user's provided translations to get what they actually translated
    const translationLines = clipboardContent.split('\n').filter(line => line.trim());
    const providedCount = translationLines.length;
    
    // Check if user provided translations for all expected dialogues
    const missingCount = expectedDialogues.length - providedCount;
    
    if (missingCount > 0) {
        console.log(`⚠️  WARNING: Expected ${expectedDialogues.length} dialogues in range ${start}-${end}, but only found ${providedCount} translations.`);
        console.log(`Missing ${missingCount} translation(s). Please ensure all dialogues are translated.`);
        console.log(`Expected dialogue numbers: ${expectedDialogues.slice(0, 10).join(', ')}${expectedDialogues.length > 10 ? '...' : ''}\n`);
    } else {
        console.log(`✅ All ${expectedDialogues.length} dialogues in range ${start}-${end} have translations.\n`);
    }
    
    return missingCount;
};

// Test the updated missing dialogue detection
const main = async () => {
    console.log("Testing updated missing dialogue detection...\n");
    
    // Test case 1: Complete translations
    console.log("Test 1 - Complete translations (5 dialogues expected, 5 provided):");
    const completeTranslations = `1. "Speaker1": "Dialogue 1"
2. "Speaker2": "Dialogue 2"
3. "Speaker3": "Dialogue 3"
4. "Speaker4": "Dialogue 4"
5. "Speaker5": "Dialogue 5"`;
    await checkMissingDialogues(1, 5, completeTranslations);
    
    // Test case 2: Incomplete translations
    console.log("Test 2 - Incomplete translations (5 dialogues expected, 3 provided):");
    const incompleteTranslations = `1. "Speaker1": "Dialogue 1"
2. "Speaker2": "Dialogue 2"
3. "Speaker3": "Dialogue 3"`;
    await checkMissingDialogues(1, 5, incompleteTranslations);
    
    console.log("Updated missing dialogue detection test completed!");
    process.exit(0);
};

main().catch(error => {
    console.error("Error:", error);
    process.exit(1);
});
