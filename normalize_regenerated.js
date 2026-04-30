import * as fs from "fs/promises";
import {replaceUnicode, wrapAt} from "./modules/TextNormalization.js";

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
            parsed.push({ lineNumber: +lineNumber, translatedEnglishLine });
        }
    }
    return parsed;
};

// Load original Japanese text from JSON
const v104AinJson = await fs.readFile("./Rance10.v1.04.ain.json", "utf-8");
const v104AinData = JSON.parse(v104AinJson);

// Create map of lineNumber -> originalJapaneseLine
const originalMap = new Map(v104AinData.map(rec => [+rec.lineNumber, rec.originalJapaneseLine]));

// Load mistranslated names
const mistranslated_names_str = await fs.readFile("./mistranslated_names.json", "utf-8");
const mistranslated_names = JSON.parse(mistranslated_names_str);
mistranslated_names.forEach(char => char.knownMistranslations.sort((a,b) => b.length - a.length));

const normalizeNames = (lineRecord) => {
    let sentence = lineRecord.translatedEnglishLine;
    for (const nameRecord of mistranslated_names) {
        if (!lineRecord.originalJapaneseLine.includes(nameRecord.shortNameJpn)) {
            continue;
        }
        const shortNameEng = nameRecord.shortNameEng;
        if (sentence.includes(shortNameEng)) {
            continue;
        }
        for (const mistranslation of nameRecord.knownMistranslations) {
            const beforeUpdate = sentence;
            sentence = sentence.replaceAll(mistranslation, shortNameEng);
            if (beforeUpdate !== sentence) {
                console.log(`Line ${lineRecord.lineNumber}: Replaced "${mistranslation}" with "${shortNameEng}"`);
            }
        }
    }
    return sentence;
};

// Read regenerated.ain.txt
const regeneratedTxt = await fs.readFile("./regenerated.ain.txt", "utf-8");
const parsedLines = parseRegeneratedAin(regeneratedTxt);

console.log(`Processing ${parsedLines.length} lines...`);

// Apply normalizeNames to each line
const LONGEST_LINE = "“More importantly, what we should discuss now is how the other";
const output = parsedLines
    .map(lr => {
        const originalJapaneseLine = originalMap.get(lr.lineNumber) || "";
        const lineRecord = { ...lr, originalJapaneseLine };
        let text = normalizeNames(lineRecord);
        text = replaceUnicode(text);
        text = wrapAt(text, LONGEST_LINE);
        return `m[${lr.lineNumber}] = ${JSON.stringify(text)}`;
    })
    .join("\n") + "\n";

// Write back to regenerated.ain.txt
await fs.writeFile("./regenerated.ain.txt", output, "utf-8");

console.log("Done! regenerated.ain.txt has been normalized.");
