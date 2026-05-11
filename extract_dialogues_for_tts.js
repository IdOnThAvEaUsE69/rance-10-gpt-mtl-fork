import * as fs from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import clipboardy from 'clipboardy';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const nextRange = 2000;

// Copy text to clipboard
const copyToClipboard = async (text) => {
    try {
        clipboardy.writeSync(text);
    } catch (error) {
        throw new Error(`Failed to copy to clipboard: ${error.message}`);
    }
};

// Replace ahh with 2+ h's with ah
const replaceAhhWithAh = (text) => {
    return text.replace(/ah{2,}/gi, 'ah');
};

// Replace excessive repeats with single letters
const replaceExcessiveRepeatWords = (text) => {
    // Process each word, handling hyphenated words by splitting them
    return text.split(/\s+/).map(word => {
        // If word contains hyphens, process each part separately
        if (word.includes('-')) {
            const parts = word.split('-').map(part => {
                // Replace any sequence of 4+ identical chars with a single char
                return part.replace(/(.)\1{3,}/g, '$1');
            });
            return parts.join('-');
        } else {
            // For non-hyphenated words, replace excessive repeats with single char
            return word.replace(/(.)\1{3,}/g, '$1');
        }
    }).join(' ');
};

// Parse Dohna file to get dialogue lines
const parseDohnaFile = (text) => {
    const lines = text.split('\n');
    const dialogueMap = new Map();
    
    for (const line of lines) {
        const trimmedLine = line.trim().replace(/\r$/, '');
        if (!trimmedLine) continue;
        
        // Check for speaker lines and skip them
        const speakerMatch = trimmedLine.match(/^;s\[(\d+)\]\s*=\s*(.*)$/);
        if (speakerMatch) {
            continue; // Skip speaker lines
        }
        
        // Check for dialogue lines
        const dialogueMatch = trimmedLine.match(/^m\[(\d+)\]\s*=\s*(.*)$/);
        if (dialogueMatch) {
            const [, lineNumber, quotedText] = dialogueMatch;
            dialogueMap.set(+lineNumber, quotedText);
        }
    }
    
    return dialogueMap;
};

// Extract dialogues from Dohna file
const extractDialoguesFromFile = async (startLine) => {
    try {
        // Read Dohna file - corrected path
        const dohnaTxt = await fs.readFile(join(__dirname, "./regenerated.ain.txt"), "utf-8");
        const dialogueMap = parseDohnaFile(dohnaTxt);
        
        // Calculate end line
        const endLine = startLine + nextRange;
        
        // Extract dialogues in range
        const dialogues = [];
        for (let i = startLine; i <= endLine; i++) {
            if (dialogueMap.has(i)) {
                const quotedText = dialogueMap.get(i);
                // Remove quotes from dialogue text and replace newlines with spaces
                let cleanDialogue = quotedText.replace(/^"|"$/g, '').replace(/\\n/g, ' ').replace(/\n/g, ' ');
                
                // Remove all quotes completely
                cleanDialogue = cleanDialogue.replace(/\\"/g, '');
                cleanDialogue = cleanDialogue.replace(/^"/, '');
                cleanDialogue = cleanDialogue.replace(/"(\s*)$/g, '');
                
                // Replace ahh with 2+ h's with ah (before replacing excessive repeats)
                cleanDialogue = replaceAhhWithAh(cleanDialogue);
                
                // Replace excessive repeats with single letters
                cleanDialogue = replaceExcessiveRepeatWords(cleanDialogue);
                
                dialogues.push(cleanDialogue);
            }
        }
        
        return dialogues;
    } catch (error) {
        console.error("Error reading dohnadohna.ain.txt:", error.message);
        return [];
    }
};

// Main
const main = async () => {
    console.log("Dohna Dohna Dialogue Extractor - Extract dialogues from Dohna file");
    console.log("=".repeat(60) + "\n");
    
    while (true) {
        console.log("Enter starting dialogue line number:");
        console.log("(Type 'quit' to exit)");
        
        const input = await new Promise(resolve => {
            process.stdin.once('data', data => resolve(data.toString().trim()));
        });
        
        if (input.toLowerCase() === 'quit' || input.toLowerCase() === 'exit') {
            console.log("Exiting...");
            break;
        }
        
        // Validate input
        const lineNumber = parseInt(input);
        if (isNaN(lineNumber) || lineNumber < 0) {
            console.log("Invalid line number. Please enter a positive number.\n");
            continue;
        }
        
        // Extract dialogues
        const dialogues = await extractDialoguesFromFile(lineNumber);
        
        if (dialogues.length > 0) {
            console.log(`\nExtracted ${dialogues.length} dialogues from lines ${lineNumber}-${lineNumber + nextRange}:\n`);
            
            // Copy dialogues to clipboard
            const dialoguesText = dialogues.map(d => d).join('\n\n');
            await copyToClipboard(dialoguesText);
            console.log(`\nCopied ${dialogues.length} dialogues to clipboard!\n`);
        } else {
            console.log(`No dialogues found in lines ${lineNumber}-${lineNumber + nextRange}.\n`);
        }
        
        console.log("Ready for next extraction...\n");
    }
    
    process.exit(0);
};

main().catch(error => {
    console.error("Error:", error.message);
    process.exit(1);
});