import * as fs from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import clipboardy from 'clipboardy';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Copy text to clipboard
const copyToClipboard = async (text) => {
    try {
        clipboardy.writeSync(text);
    } catch (error) {
        throw new Error(`Failed to copy to clipboard: ${error.message}`);
    }
};

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
    let lastSpeaker = null;
    
    for (const item of parsed) {
        if (item.type === 'dialogue' && item.lineNumber >= start && item.lineNumber <= end) {
            if (lastSpeaker !== null) {
                result.push(lastSpeaker);
                lastSpeaker = null; // Reset after adding speaker
            }
            result.push(item.originalLine);
        } else if (item.type === 'speaker') {
            lastSpeaker = item.originalLine;
        }
    }
    
    return result.join('\n');
};

// Update regenerated.ain.txt with English translation
const updateRegeneratedFile = async (start, end, translationLines) => {
    const regeneratedTxt = await fs.readFile(join(__dirname, "./regenerated.ain.txt"), "utf-8");
    const lines = regeneratedTxt.split("\n");
    
    // Parse translation lines to separate dialogue and speaker lines
    const parsedTranslations = [];
    for (const line of translationLines) {
        const trimmedLine = line.trim().replace(/\r$/, '');
        if (!trimmedLine) continue;
        
        const speakerMatch = trimmedLine.match(/^;s\[(\d+)\]\s*=\s*(.*)$/);
        if (speakerMatch) {
            parsedTranslations.push({ type: 'speaker', lineNumber: +speakerMatch[1], content: trimmedLine });
            continue;
        }
        
        const dialogueMatch = trimmedLine.match(/^m\[(\d+)\]\s*=\s*(.*)$/);
        if (dialogueMatch) {
            parsedTranslations.push({ type: 'dialogue', lineNumber: +dialogueMatch[1], content: trimmedLine });
            continue;
        }
    }
    
    // Create a map of line numbers to translation content
    const translationMap = new Map();
    for (const item of parsedTranslations) {
        translationMap.set(item.lineNumber, item);
    }
    
    // Update the regenerated file
    for (let i = 0; i < lines.length; i++) {
        const trimmedLine = lines[i].trim().replace(/\r$/, '');
        if (!trimmedLine) continue;
        
        const speakerMatch = trimmedLine.match(/^;s\[(\d+)\]\s*=\s*(.*)$/);
        if (speakerMatch) {
            const lineNumber = +speakerMatch[1];
            if (lineNumber >= start && lineNumber <= end && translationMap.has(lineNumber)) {
                const translation = translationMap.get(lineNumber);
                if (translation.type === 'speaker') {
                    lines[i] = translation.content;
                }
            }
            continue;
        }
        
        const dialogueMatch = trimmedLine.match(/^m\[(\d+)\]\s*=\s*(.*)$/);
        if (dialogueMatch) {
            const lineNumber = +dialogueMatch[1];
            if (lineNumber >= start && lineNumber <= end && translationMap.has(lineNumber)) {
                const translation = translationMap.get(lineNumber);
                if (translation.type === 'dialogue') {
                    lines[i] = translation.content;
                }
            }
        }
    }
    
    const updatedText = lines.join("\n");
    await fs.writeFile(join(__dirname, "./regenerated.ain.txt"), updatedText, "utf-8");
};

// Main
const main = async () => {
    console.log("Loading regenerated_japanese.ain.txt...");
    const text = await fs.readFile(join(__dirname, "./regenerated_japanese.ain.txt"), "utf-8");
    const parsed = parseAinTxt(text);
    console.log("Loaded. Ready to copy Japanese dialogues.\n");
    
    while (true) {
        console.log("Enter a range (e.g., '65711-65717') or 'quit' to exit:");
        
        const input = await new Promise(resolve => {
            process.stdin.once('data', data => resolve(data.toString().trim()));
        });
        
        if (input.toLowerCase() === 'quit' || input.toLowerCase() === 'exit') {
            console.log("Exiting...");
            break;
        }
        
        const rangeMatch = input.match(/^(\d+)-(\d+)$/);
        if (!rangeMatch) {
            console.log("Invalid format. Use format: start-end (e.g., 65711-65717)\n");
            continue;
        }
        
        const [, startStr, endStr] = rangeMatch;
        const start = +startStr;
        const end = +endStr;
        
        if (start > end) {
            console.log("Start number must be less than or equal to end number.\n");
            continue;
        }
        
        const extracted = extractRange(parsed, start, end);
        
        if (!extracted) {
            console.log(`No dialogues found in range ${start}-${end}.\n`);
            continue;
        }
        
        console.log(`Extracted dialogues from ${start} to ${end}:`);
        console.log("\nCopying to clipboard...");
        
        try {
            await copyToClipboard(extracted);
            console.log("Copied to clipboard!\n");
        } catch (error) {
            console.error("Failed to copy to clipboard:", error.message);
            console.log("Here is the text to copy manually:\n");
            console.log(extracted);
            console.log();
        }
        
        console.log("Copy the English translation to clipboard, then press Enter to paste it:");
        
        // Wait for user to press Enter
        await new Promise(resolve => {
            process.stdin.once('data', data => resolve(data.toString().trim()));
        });
        
        // Read from clipboard
        const clipboardContent = clipboardy.readSync();
        
        // Process clipboard content
        if (clipboardContent.trim()) {
            const translationLines = clipboardContent.split('\n').filter(line => line.trim());
            console.log("\nUpdating regenerated.ain.txt with English translation...");
            await updateRegeneratedFile(start, end, translationLines);
            console.log("Updated regenerated.ain.txt\n");
        } else {
            console.log("Clipboard is empty, skipping update.\n");
        }
    }
    
    process.exit(0);
};

main().catch(error => {
    console.error("Error:", error);
    process.exit(1);
});
