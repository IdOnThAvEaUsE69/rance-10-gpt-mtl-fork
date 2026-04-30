import * as fs from "fs/promises";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse ain.txt format: m[lineNumber] = "text"
const parseAinTxt = (text) => {
    const lines = text.split("\n");
    const parsed = new Map();
    for (const line of lines) {
        const trimmedLine = line.trim().replace(/\r$/, '');
        if (!trimmedLine) continue;
        const match = trimmedLine.match(/^m\[(\d+)\]\s*=\s*(.*)$/);
        if (match) {
            const [, lineNumber, quotedText] = match;
            parsed.set(+lineNumber, trimmedLine);
        }
    }
    return parsed;
};

// Wrap text at 60 characters
const wrapText = (quotedText, maxLength = 60) => {
    const text = quotedText.match(/^"(.*)"$/);
    if (!text) return quotedText;
    
    let content = text[1];
    content = content.replace(/\\n/g, ' ');
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
            const lastSpaceIndex = current.lastIndexOf(' ');
            
            if (lastSpaceIndex > 0) {
                result.push(current.substring(0, lastSpaceIndex));
                current = current.substring(lastSpaceIndex + 1);
            } else {
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

// Read files
const regeneratedTxt = await fs.readFile(join(__dirname, "./regenerated.ain.txt"), "utf-8");
const regeneratedOriginalTxt = await fs.readFile(join(__dirname, "./regenerated_original.ain.txt"), "utf-8");
const translatedTxt = await fs.readFile(join(__dirname, "./translated.ain.txt"), "utf-8");

const regeneratedMap = parseAinTxt(regeneratedTxt);
const regeneratedOriginalMap = parseAinTxt(regeneratedOriginalTxt);
const translatedMap = parseAinTxt(translatedTxt);

console.log(`Regenerated lines: ${regeneratedMap.size}`);
console.log(`Regenerated original lines: ${regeneratedOriginalMap.size}`);
console.log(`Translated lines: ${translatedMap.size}`);

let changedLines = [];
let wrappedCount = 0;
const wrappedLineMap = new Map(); // lineNumber -> wrapped line
const wrappedLineNumbers = []; // track which lines were wrapped

// Check for changed lines between regenerated and regenerated_original
for (const [lineNumber, regeneratedLine] of regeneratedMap) {
    if (regeneratedOriginalMap.has(lineNumber)) {
        const originalLine = regeneratedOriginalMap.get(lineNumber);
        if (originalLine !== regeneratedLine) {
            // Line changed - only add if not already in translated
            if (!translatedMap.has(lineNumber)) {
                // Wrap the changed line
                const match = regeneratedLine.match(/^m\[(\d+)\]\s*=\s*(.*)$/);
                if (match) {
                    const [, ln, quotedText] = match;
                    const wrappedQuotedText = wrapText(quotedText, 60);
                    const wrappedLine = `m[${ln}] = ${wrappedQuotedText}`;
                    changedLines.push(wrappedLine);
                    wrappedLineMap.set(lineNumber, wrappedLine);
                    
                    if (wrappedQuotedText !== quotedText) {
                        wrappedCount++;
                        wrappedLineNumbers.push(lineNumber);
                    }
                    
                    console.log(`Changed m[${lineNumber}]:`);
                    console.log(`  Original: ${originalLine}`);
                    console.log(`  New: ${wrappedLine}`);
                } else {
                    changedLines.push(regeneratedLine);
                    console.log(`Changed m[${lineNumber}]:`);
                    console.log(`  Original: ${originalLine}`);
                    console.log(`  New: ${regeneratedLine}`);
                }
            } else {
                console.log(`Skipping m[${lineNumber}] - already exists in translated.ain.txt`);
            }
        }
    }
}

console.log(`\nChanged lines: ${changedLines.length}`);
console.log(`Wrapped lines: ${wrappedCount}`);
if (wrappedLineNumbers.length > 0) {
    console.log(`Wrapped line numbers: ${wrappedLineNumbers.join(', ')}`);
}

// Append changed lines to translated.ain.txt
if (changedLines.length > 0) {
    const output = translatedTxt.trim() + "\n" + changedLines.join("\n") + "\n";
    await fs.writeFile(join(__dirname, "./translated.ain.txt"), output, "utf-8");
    console.log(`Done! Appended ${changedLines.length} lines to translated.ain.txt`);
} else {
    console.log("No changed lines to append.");
}

// Update regenerated.ain.txt with wrapped lines
if (wrappedLineMap.size > 0) {
    const regeneratedLines = regeneratedTxt.split("\n");
    let updatedCount = 0;
    
    for (let i = 0; i < regeneratedLines.length; i++) {
        const line = regeneratedLines[i].trim().replace(/\r$/, '');
        const match = line.match(/^m\[(\d+)\]\s*=\s*(.*)$/);
        if (match) {
            const [, lineNumber] = match;
            if (wrappedLineMap.has(+lineNumber)) {
                regeneratedLines[i] = wrappedLineMap.get(+lineNumber);
                updatedCount++;
            }
        }
    }
    
    const outputText = regeneratedLines.join("\n") + "\n";
    await fs.writeFile(join(__dirname, "./regenerated.ain.txt"), outputText, "utf-8");
    console.log(`Done! Updated ${updatedCount} lines in regenerated.ain.txt`);
}

// Run alice.exe command
console.log("\nRunning alice.exe to update AIN file...");
const alicePath = "D:\\Programs\\Compressed\\Rance_3 V1.01\\alice-tools-0.13.0\\alice.exe";
const outputPath = "D:\\Program Files\\Rance 10\\New Rance 10\\ランス１０\\Rance10.ain";
const inputPath = join(__dirname, ".\\Rance10.v1.04.ain");

await new Promise((resolve, reject) => {
    const child = spawn(alicePath, ["ain", "edit", "-t", join(__dirname, "regenerated.ain.txt"), "-o", outputPath, inputPath], {
        cwd: __dirname
    });
    
    child.stdout.on('data', (data) => {
        console.log(data.toString());
    });
    
    child.stderr.on('data', (data) => {
        console.error(data.toString());
    });
    
    child.on('close', (code) => {
        if (code === 0) {
            console.log("\nDone! AIN file updated successfully.");
            resolve();
        } else {
            reject(new Error(`alice.exe exited with code ${code}`));
        }
    });
});
