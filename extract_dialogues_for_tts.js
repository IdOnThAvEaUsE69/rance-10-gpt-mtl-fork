import * as fs from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import clipboardy from 'clipboardy';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const nextRange = 500;

// Copy text to clipboard
const copyToClipboard = async (text) => {
    try {
        clipboardy.writeSync(text);
    } catch (error) {
        throw new Error(`Failed to copy to clipboard: ${error.message}`);
    }
};

// Parse AIN file to get dialogue lines
const parseAinTxt = (text) => {
    const lines = text.split('\n');
    const dialogueMap = new Map();
    
    for (const line of lines) {
        const trimmedLine = line.trim().replace(/\r$/, '');
        if (!trimmedLine) continue;
        
        const match = trimmedLine.match(/^m\[(\d+)\]\s*=\s*(.*)$/);
        if (match) {
            const [, lineNumber, quotedText] = match;
            dialogueMap.set(+lineNumber, quotedText);
        }
    }
    
    return dialogueMap;
};

// Extract dialogues from English regenerated file
const extractDialoguesFromFile = async (startLine) => {
    try {
        // Read the English regenerated file
        const regeneratedTxt = await fs.readFile(join(__dirname, "./regenerated.ain.txt"), "utf-8");
        const dialogueMap = parseAinTxt(regeneratedTxt);
        
        // Calculate end line
        const endLine = startLine + nextRange;
        
        // Extract dialogues in the range
        const dialogues = [];
        for (let i = startLine; i <= endLine; i++) {
            if (dialogueMap.has(i)) {
                const quotedText = dialogueMap.get(i);
                // Remove quotes from the dialogue text and replace newlines with spaces
                const cleanDialogue = quotedText.replace(/^"|"$/g, '').replace(/\\n/g, ' ').replace(/\n/g, ' ');
                dialogues.push(cleanDialogue);
            }
        }
        
        return dialogues;
    } catch (error) {
        console.error("Error reading regenerated.ain.txt:", error.message);
        return [];
    }
};

// Main
const main = async () => {
    console.log("Dialogue Extractor - Extract dialogues from English regenerated file");
    console.log("=".repeat(60) + "\n");
    
    while (true) {
        console.log("Enter the starting dialogue line number:");
        console.log("(Type 'quit' to exit)\n");
        
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
            const dialoguesText = dialogues.map(d => `"${d}"`).join('\n');
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
