import * as fs from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse ain.txt format: m[lineNumber] = "text"
const parseAinTxt = (text) => {
    const lines = text.split("\n");
    const parsed = [];
    for (const line of lines) {
        const trimmedLine = line.trim().replace(/\r$/, '');
        if (!trimmedLine) {
            parsed.push({ type: 'empty', line: trimmedLine });
            continue;
        }
        const match = trimmedLine.match(/^m\[(\d+)\]\s*=\s*(.*)$/);
        if (match) {
            const [, lineNumber, quotedText] = match;
            parsed.push({ type: 'message', lineNumber: +lineNumber, quotedText, originalLine: trimmedLine });
        } else {
            parsed.push({ type: 'other', line: trimmedLine });
        }
    }
    return parsed;
};

// Wrap text at 60 characters
const wrapText = (quotedText, maxLength = 60) => {
    // Remove surrounding quotes
    const text = quotedText.match(/^"(.*)"$/);
    if (!text) return quotedText;
    
    let content = text[1];
    
    // Remove all existing newlines
    content = content.replace(/\\n/g, ' ');
    
    // Wrap the clean content
    const wrapped = wrapSegment(content, maxLength);
    return `"${wrapped}"`;
};

const wrapSegment = (segment, maxLength) => {
    if (segment.length <= maxLength) return segment;
    
    const result = [];
    let current = '';
    
    for (let i = 0; i < segment.length; i++) {
        current += segment[i];
        
        if (current.length >= maxLength) {
            // Find the last space to avoid cutting words
            const lastSpaceIndex = current.lastIndexOf(' ');
            
            if (lastSpaceIndex > 0) {
                // Break at the space
                result.push(current.substring(0, lastSpaceIndex));
                // Start new line with the remaining part after the space
                current = current.substring(lastSpaceIndex + 1);
            } else {
                // No space found, force break at maxLength (single long word)
                result.push(current);
                current = '';
            }
        }
    }
    
    if (current) {
        result.push(current);
    }
    
    return result.join('\\n');
};

// Process file
const processFile = async (filePath) => {
    console.log(`Processing ${filePath}...`);
    
    const text = await fs.readFile(filePath, "utf-8");
    const parsed = parseAinTxt(text);
    
    let wrappedCount = 0;
    const output = [];
    
    for (const item of parsed) {
        if (item.type === 'message') {
            const newQuotedText = wrapText(item.quotedText, 60);
            if (newQuotedText !== item.quotedText) {
                wrappedCount++;
                console.log(`Wrapped m[${item.lineNumber}]: ${item.quotedText.substring(0, 50)}...`);
            }
            output.push(`m[${item.lineNumber}] = ${newQuotedText}`);
        } else if (item.type === 'empty') {
            output.push('');
        } else {
            output.push(item.line);
        }
    }
    
    const outputText = output.join("\n") + "\n";
    await fs.writeFile(filePath, outputText, "utf-8");
    
    console.log(`Wrapped ${wrappedCount} lines in ${filePath}`);
};

// Process both files
await processFile(join(__dirname, "./regenerated.ain.txt"));
await processFile(join(__dirname, "./regenerated_original.ain.txt"));

console.log("\nDone!");
