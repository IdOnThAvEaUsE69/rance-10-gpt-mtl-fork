import * as fs from "fs/promises";
import { spawn } from "child_process";

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

// Read files
const regeneratedTxt = await fs.readFile("./regenerated.ain.txt", "utf-8");
const regeneratedOriginalTxt = await fs.readFile("./regenerated_original.ain.txt", "utf-8");
const translatedTxt = await fs.readFile("./translated.ain.txt", "utf-8");

const regeneratedMap = parseAinTxt(regeneratedTxt);
const regeneratedOriginalMap = parseAinTxt(regeneratedOriginalTxt);
const translatedMap = parseAinTxt(translatedTxt);

console.log(`Regenerated lines: ${regeneratedMap.size}`);
console.log(`Regenerated original lines: ${regeneratedOriginalMap.size}`);
console.log(`Translated lines: ${translatedMap.size}`);

let changedLines = [];

// Check for changed lines between regenerated and regenerated_original
for (const [lineNumber, regeneratedLine] of regeneratedMap) {
    if (regeneratedOriginalMap.has(lineNumber)) {
        const originalLine = regeneratedOriginalMap.get(lineNumber);
        if (originalLine !== regeneratedLine) {
            // Line changed - only add if not already in translated
            if (!translatedMap.has(lineNumber)) {
                changedLines.push(regeneratedLine);
                console.log(`Changed m[${lineNumber}]:`);
                console.log(`  Original: ${originalLine}`);
                console.log(`  New: ${regeneratedLine}`);
            } else {
                console.log(`Skipping m[${lineNumber}] - already exists in translated.ain.txt`);
            }
        }
    }
}

console.log(`\nChanged lines: ${changedLines.length}`);

// Append changed lines to translated.ain.txt
if (changedLines.length > 0) {
    const output = translatedTxt.trim() + "\n" + changedLines.join("\n") + "\n";
    await fs.writeFile("./translated.ain.txt", output, "utf-8");
    console.log(`Done! Appended ${changedLines.length} lines to translated.ain.txt`);
} else {
    console.log("No changed lines to append.");
}

// Run alice.exe command
console.log("\nRunning alice.exe to update AIN file...");
const alicePath = "\"D:\\Programs\\Compressed\\Rance_3 V1.01\\alice-tools-0.13.0\\alice.exe\"";
const outputPath = "\"D:\\Program Files\\Rance 10\\New Rance 10\\ランス１０\\Rance10.ain\"";
const inputPath = ".\\Rance10.v1.04.ain";

await new Promise((resolve, reject) => {
    const child = spawn(alicePath, ["ain", "edit", "-t", "regenerated.ain.txt", "-o", outputPath, inputPath], {
        cwd: process.cwd(),
        shell: true
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
