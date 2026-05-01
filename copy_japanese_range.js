import * as fs from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import clipboardy from 'clipboardy';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const nextRange = 1000

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
    
    // Extract dialogue line numbers from clipboard
    const dialogueLineNumbers = [];
    for (const line of translationLines) {
        const trimmedLine = line.trim().replace(/\r$/, '');
        const dialogueMatch = trimmedLine.match(/^m\[(\d+)\]\s*=\s*(.*)$/);
        if (dialogueMatch) {
            dialogueLineNumbers.push(+dialogueMatch[1]);
        }
    }
    
    if (dialogueLineNumbers.length === 0) {
        console.log("No dialogue lines found in clipboard, skipping update.\n");
        return;
    }
    
    const firstLineNumber = Math.min(...dialogueLineNumbers);
    const lastLineNumber = Math.max(...dialogueLineNumbers);
    
    // Find the positions of first and last dialogue lines in regenerated file
    let firstLineIndex = -1;
    let lastLineIndex = -1;
    
    for (let i = 0; i < lines.length; i++) {
        const trimmedLine = lines[i].trim().replace(/\r$/, '');
        const dialogueMatch = trimmedLine.match(/^m\[(\d+)\]\s*=\s*(.*)$/);
        
        if (dialogueMatch) {
            const lineNumber = +dialogueMatch[1];
            if (lineNumber === firstLineNumber && firstLineIndex === -1) {
                firstLineIndex = i;
            }
            if (lineNumber === lastLineNumber) {
                lastLineIndex = i;
            }
        }
    }
    
    if (firstLineIndex === -1 || lastLineIndex === -1) {
        console.log(`Could not find dialogue lines ${firstLineNumber}-${lastLineNumber} in regenerated file.\n`);
        return;
    }
    
    // Find the speaker line before the first dialogue line (if any)
    let speakerLineIndex = -1;
    for (let i = firstLineIndex - 1; i >= 0; i--) {
        const trimmedLine = lines[i].trim().replace(/\r$/, '');
        const speakerMatch = trimmedLine.match(/^;s\[(\d+)\]\s*=\s*(.*)$/);
        if (speakerMatch) {
            speakerLineIndex = i;
            break;
        } else if (trimmedLine) {
            // Stop if we hit a non-empty non-speaker line
            break;
        }
    }
    
    // Remove the speaker line if it exists
    let startIndex = firstLineIndex;
    if (speakerLineIndex !== -1) {
        startIndex = speakerLineIndex;
    }
    
    // Replace the entire range with clipboard content
    const beforeRange = lines.slice(0, startIndex);
    const afterRange = lines.slice(lastLineIndex + 1);
    
    // Add a blank line between different speakers if clipboard has multiple speakers
    const processedTranslationLines = [];
    let lastSpeakerId = null;
    
    for (const line of translationLines) {
        const trimmedLine = line.trim().replace(/\r$/, '');
        if (!trimmedLine) continue;
        
        const speakerMatch = trimmedLine.match(/^;s\[(\d+)\]\s*=\s*(.*)$/);
        if (speakerMatch) {
            const speakerId = +speakerMatch[1];
            if (lastSpeakerId !== null && lastSpeakerId !== speakerId) {
                processedTranslationLines.push(""); // Add blank line between speakers
            }
            lastSpeakerId = speakerId;
        }
        processedTranslationLines.push(line);
    }
    
    const updatedLines = [...beforeRange, ...processedTranslationLines, ...afterRange];
    
    const updatedText = updatedLines.join("\n");
    await fs.writeFile(join(__dirname, "./regenerated.ain.txt"), updatedText, "utf-8");
};

// Main
const main = async () => {
    console.log("Loading regenerated_japanese.ain.txt...");
    const text = await fs.readFile(join(__dirname, "./regenerated_japanese.ain.txt"), "utf-8");
    const parsed = parseAinTxt(text);
    console.log("Loaded. Ready to copy Japanese dialogues.\n");
    
    let lastEnd = null;
    
    while (true) {
        let defaultInput = '';
        if (lastEnd !== null) {
            defaultInput = (lastEnd + 1) + "-" + (lastEnd + 1000);
        }
        
        const input = await new Promise(resolve => {
            if (defaultInput) {
                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                });
                
                console.log("Enter a range or 'quit' to exit:");
                console.log("(Default: " + defaultInput + " - press Enter to use)");
                rl.write(defaultInput);
                
                rl.question('', (answer) => {
                    rl.close();
                    resolve(answer.trim());
                });
            } else {
                console.log("Enter a range or 'quit' to exit:");
                process.stdin.once('data', data => {
                    resolve(data.toString().trim());
                });
            }
        });
        
        if (input.toLowerCase() === 'quit' || input.toLowerCase() === 'exit') {
            console.log("Exiting...");
            break;
        }
        
        let start, end;
        
        const rangeMatch = input.match(/^(\d+)-(\d+)$/);
        if (!rangeMatch) {
            console.log("Invalid format. Use format: start-end (e.g., 65711-65717)\n");
            continue;
        }
        
        const [, startStr, endStr] = rangeMatch;
        start = +startStr;
        end = +endStr;
        
        if (start > end) {
            console.log("Start number must be less than or equal to end number.\n");
            continue;
        }
        
        // Update lastEnd for next iteration
        lastEnd = end;
        
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
