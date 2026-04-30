import * as fs from "fs/promises";

// Parse regenerated.ain.txt format: m[lineNumber] = "text"
const parseRegeneratedAin = (text) => {
    const lines = text.split("\n");
    const parsed = [];
    for (const line of lines) {
        const trimmedLine = line.trim().replace(/\r$/, '');
        if (!trimmedLine) continue;
        const match = trimmedLine.match(/^m\[(\d+)\]\s*=\s*(.*)$/);
        if (match) {
            const [, lineNumber, quotedText] = match;
            const quoteMatch = quotedText.match(/^"(.*)"$/);
            const translatedEnglishLine = quoteMatch ? JSON.parse(quotedText.replace(/\t/g, "\\t")) : quotedText;
            parsed.push({ lineNumber: +lineNumber, translatedEnglishLine, originalLine: trimmedLine });
        }
    }
    return parsed;
};

// Read regenerated.ain.txt
const regeneratedTxt = await fs.readFile("./regenerated.ain.txt", "utf-8");
const parsedLines = parseRegeneratedAin(regeneratedTxt);

console.log(`Total lines: ${parsedLines.length}`);

// Find duplicate line numbers
const lineNumberMap = new Map();
const duplicates = [];

for (const line of parsedLines) {
    if (lineNumberMap.has(line.lineNumber)) {
        duplicates.push({
            lineNumber: line.lineNumber,
            first: lineNumberMap.get(line.lineNumber),
            second: line
        });
    } else {
        lineNumberMap.set(line.lineNumber, line);
    }
}

if (duplicates.length > 0) {
    console.log(`\nFound ${duplicates.length} duplicate line numbers:\n`);
    for (const dup of duplicates) {
        console.log(`Line m[${dup.lineNumber}]:`);
        console.log(`  First:  ${dup.first.originalLine}`);
        console.log(`  Second: ${dup.second.originalLine}`);
        console.log();
    }
} else {
    console.log("\nNo duplicate line numbers found.");
}
