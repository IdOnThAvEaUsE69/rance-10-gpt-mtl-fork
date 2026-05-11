import * as fs from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import clipboardy from 'clipboardy';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const nextRange = 500

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
    
    let count = 0;
    let lastSpeakerCount, firstDialogueCount, hasEncounteredFirstDialogue;
    let firstSpeaker;
    for (const item of parsed) {
        count += 1
        // console.log(item.lineNumber, count)
        if (item.type === 'dialogue' && item.lineNumber > end) break;

        // console.log(`[${count}] ${item.originalLine}`)

        if (item.type === 'dialogue' && item.lineNumber >= start && item.lineNumber <= end) {
            if (lastSpeaker !== null) {
                if (hasEncounteredFirstDialogue == true)
                    result.push(lastSpeaker);
                else
                    firstSpeaker = lastSpeaker;
                lastSpeaker = null; // Reset after adding speaker
            }
            hasEncounteredFirstDialogue = true

            if (firstDialogueCount == null) {
                firstDialogueCount = count;
                // console.log(item.originalLine);
            }
            result.push(item.originalLine);
        } else if (item.type === 'speaker') {
            lastSpeaker = item.originalLine;

            if (hasEncounteredFirstDialogue == null) {
                lastSpeakerCount = count;
                // console.log(lastSpeaker);
            }
        }
    }

    count = 0;
    const lastSpeakerResult = [];
    lastSpeakerResult.push(firstSpeaker);
    for (const item of parsed) {
        count += 1
        if (item.type === 'dialogue' && item.lineNumber > end) break;

        if (lastSpeakerCount < count && count < firstDialogueCount) {
            lastSpeakerResult.push(item.originalLine);
        }
    }

    // Log the missing starting lines
    console.log(`Missing lines: ${lastSpeakerResult.join('\n')}`)
    
    return [...lastSpeakerResult, ...result].join('\n');
    
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

// Check for missing dialogues in user's provided translations
const checkMissingDialogues = async (clipboardContent) => {
    // Parse user's provided translations to get what they actually translated
    const translationLines = clipboardContent.split('\n').filter(line => line.trim());
    const providedNumbers = new Set();
    
    for (const line of translationLines) {
        const trimmedLine = line.trim().replace(/^\d+\.\s*/, ''); // Remove number and dot
        if (!trimmedLine) continue;

        // Now it's m[x] = "..." - Extract the x
        const mMatch = trimmedLine.match(/^m\[(\d+)\]\s*=\s*".*"$/);
        if (mMatch) {
            const mNumber = parseInt(mMatch[1]);
            providedNumbers.add(mNumber);
        }
    }

    // Extract the starting and ending number from clipboardContent
    const numbers = Array.from(providedNumbers).sort((a, b) => a - b);
    if (numbers.length === 0) {
        console.log(`⚠️  No dialogue translations found with m[] numbers in the provided content.\n`);
        return false;
    }
    
    const start = numbers[0];
    const end = numbers[numbers.length - 1];

    // Check if providedNumbers has all numbers between start and end
    const missingNumbers = [];
    for (let i = start; i <= end; i++) {
        if (!providedNumbers.has(i)) {
            missingNumbers.push(i);
        }
    }
    
    // Log the missing dialogue numbers and return true if no missing dialogues, else false
    if (missingNumbers.length > 0) {
        console.log(`⚠️  WARNING: Missing ${missingNumbers.length} dialogue translations in range ${start}-${end}:`);
        console.log(`Missing numbers: ${missingNumbers.join(', ')}\n`);
        return false;
    } else {
        console.log(`✅ Found ${providedNumbers.size} dialogue translations with m[] numbers: ${Array.from(providedNumbers).join(', ')}`);
        console.log(`✅ All dialogues in range ${start}-${end} are translated.\n`);
        return true;
    }
};

// Parse strict paired format and ignore useless text
const parseStrictPairedFormat = (content) => {
    const lines = content.split('\n').filter(line => line.trim());
    const result = [];
    let inMyVersionSection = false;
    
    for (const line of lines) {
        const trimmedLine = line.trim().replace(/\r$/, '').replace(/^\*+/, '').replace(/\*+$/, '');
        if (!trimmedLine) continue;
        
        // Check for Original blocks - skip them
        if (trimmedLine.startsWith('Original:')) {
            inMyVersionSection = false; // Reset when we see Original
            continue; // Skip these header lines
        }
        
        // Check for My version blocks - start collecting
        if (trimmedLine.startsWith('Translated:') || trimmedLine.startsWith('My version:')) {
            inMyVersionSection = true; // Start collecting when we see My version
            continue; // Skip these header lines
        }
        
        // Check for code block markers
        if (trimmedLine.startsWith('```') || trimmedLine === '```') {
            continue; // Skip code block markers
        }
        
        // Only process lines when we're in a My version section
        if (!inMyVersionSection) {
            continue;
        }
        
        // Check for speaker lines
        const speakerMatch = trimmedLine.match(/^;s\[(\d+)\]\s*=\s*(.*)$/);
        if (speakerMatch) {
            result.push(trimmedLine);
            // inMyVersionSection = false;
            continue;
        }
        
        // Check for dialogue lines
        const dialogueMatch = trimmedLine.match(/^m\[(\d+)\]\s*=\s*(.*)$/);
        if (dialogueMatch) {
            result.push(trimmedLine);
            // inMyVersionSection = false;
            continue;
        }
        
        // Skip any other text (like "Useless text below final translation")
        if (trimmedLine && !speakerMatch && !dialogueMatch) {
            continue;
        }
    }
    
    return result;
};

// Main
const main = async () => {
    console.log("Loading regenerated_japanese.ain.txt...");
    const text = await fs.readFile(join(__dirname, "./regenerated_japanese.ain.txt"), "utf-8");
    const parsed = parseAinTxt(text);
    console.log("Loaded. Ready to copy Japanese dialogues.\n");
    
    let lastEnd = null;
    
    while (true) {
        console.log("Enter a range (e.g., '1-1000'), single number (e.g., '1'), or 'quit' to exit:");
        if (lastEnd !== null) {
            console.log("(Press Enter for auto-range: " + (lastEnd + 1) + "-" + (lastEnd + nextRange) + ")");
        }
        
        const input = await new Promise(resolve => {
            process.stdin.once('data', data => resolve(data.toString().trim()));
        });
        
        if (input.toLowerCase() === 'quit' || input.toLowerCase() === 'exit') {
            console.log("Exiting...");
            break;
        }
        
        let start, end;
        
        if (input === '' && lastEnd !== null) {
            // Auto-range: use last end + 1 as start to avoid duplicates, add nextRange for end
            start = lastEnd + 1;
            end = lastEnd + nextRange;
        } else {
            const rangeMatch = input.match(/^(\d+)-(\d+)$/);
            const singleMatch = input.match(/^(\d+)$/);
            
            if (rangeMatch) {
                // Full range format: start-end
                const [, startStr, endStr] = rangeMatch;
                start = +startStr;
                end = +endStr;
                
                if (start > end) {
                    console.log("Start number must be less than or equal to end number.\n");
                    continue;
                }
            } else if (singleMatch) {
                // Single number format: calculate end as start + nextRange
                start = +singleMatch[1];
                end = start + nextRange;
            } else {
                console.log("Invalid format. Use format: start-end (e.g., 65711-65717) or single number (e.g., 65711)\n");
                continue;
            }
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
            // Check for missing dialogues before updating
            console.log("Checking for missing dialogues in range...");
            const hasAllDialogues = await checkMissingDialogues(clipboardContent);
            
            if (!hasAllDialogues) {
                console.log("Skipping update due to missing dialogues.\n");
                continue;
            }
            
            // Parse strict paired format and ignore useless text
            const parsedTranslations = parseStrictPairedFormat(clipboardContent);
            console.log("Updating regenerated.ain.txt with English translation...");
            await updateRegeneratedFile(start, end, parsedTranslations);
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
