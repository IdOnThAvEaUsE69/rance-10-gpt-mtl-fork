import * as fs from "fs/promises";

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

// Read both files
const translatedTxt = await fs.readFile("./translated.ain.txt", "utf-8");
const regeneratedTxt = await fs.readFile("./regenerated.ain.txt", "utf-8");

const translatedMap = parseAinTxt(translatedTxt);
const regeneratedMap = parseAinTxt(regeneratedTxt);

console.log(`Translated lines: ${translatedMap.size}`);
console.log(`Regenerated lines: ${regeneratedMap.size}`);

let replacedCount = 0;
let unchangedCount = 0;

// Apply translations from translated.ain.txt to regenerated.ain.txt
for (const [lineNumber, translatedLine] of translatedMap) {
    if (regeneratedMap.has(lineNumber)) {
        const existingLine = regeneratedMap.get(lineNumber);
        if (existingLine !== translatedLine) {
            regeneratedMap.set(lineNumber, translatedLine);
            replacedCount++;
            console.log(`Replaced m[${lineNumber}]:`);
            console.log(`  Old: ${existingLine}`);
            console.log(`  New: ${translatedLine}`);
        } else {
            unchangedCount++;
        }
    }
}

console.log(`\nReplaced: ${replacedCount}`);
console.log(`Unchanged (same text): ${unchangedCount}`);
console.log(`Not found in regenerated: ${translatedMap.size - replacedCount - unchangedCount}`);

// Sort by line number and rebuild the file
const output = [...regeneratedMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, line]) => line)
    .join("\n") + "\n";

await fs.writeFile("./regenerated.ain.txt", output, "utf-8");

console.log("\nDone! regenerated.ain.txt has been updated.");
