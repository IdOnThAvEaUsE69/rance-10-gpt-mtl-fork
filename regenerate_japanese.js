import * as fs from "fs/promises";

// Map line numbers between v1.00 and v1.04
const mapLineNumbers = (v100AinData, v104AinData) => {
    let v100Offset = 0;
    let v104LastMappedOffset = -1;
    const mapping = new Map();
    done:
    while (v100Offset < v100AinData.length) {
        for (let v104Offset = v104LastMappedOffset + 1; v104Offset < v104AinData.length; ++v104Offset) {
            const v100Record = v100AinData[v100Offset];
            const v104Record = v104AinData[v104Offset];
            if (v100Record.originalJapaneseLine === v104Record.originalJapaneseLine) {
                mapping.set(+v100Record.lineNumber, +v104Record.lineNumber);
                ++v100Offset;
                v104LastMappedOffset = v104Offset;
                if (v100Offset === v100AinData.length) {
                    break done;
                }
            }
        }
        ++v100Offset;
    }
    const mapped = new Set(mapping.values());
    const unmapped = v104AinData.filter(rec => !mapped.has(+rec.lineNumber));
    return [mapping, unmapped];
};

// Read translation chunks
const readTranslations = async (folderPath) => {
    const chunkFileNames = await fs.readdir(folderPath);
    const chunkFiles = chunkFileNames
        .map(fileName => {
            const [, startLineNumber, endLineNumber] = fileName.match(/^(\d+)_(\d+)\.json$/);
            return {
                fileName,
                startLineNumber: Number(startLineNumber),
                endLineNumber: Number(endLineNumber),
            };
        })
        .sort((a,b) => a.startLineNumber - b.startLineNumber);

    const allLineRecords = [];

    for (const chunkFile of chunkFiles) {
        const json = await fs.readFile(folderPath + "/" + chunkFile.fileName, "utf-8");
        const data = JSON.parse(json);
        allLineRecords.push(...data.output_parsed.translationLines);
    }

    return allLineRecords;
};

// Parse Rance10.v1.04.ain.txt to get speaker data
const parseSpeakerMapping = (text) => {
    const lines = text.split("\n");
    const speakerMap = new Map(); // speakerId -> speaker text
    const messageToSpeaker = new Map(); // lineNumber -> speakerId
    
    let currentSpeakerId = null;
    
    for (const line of lines) {
        const trimmedLine = line.trim().replace(/\r$/, '');
        if (!trimmedLine) continue;
        
        // Parse speaker line: ;s[4629] = "ランス／基本"
        const speakerMatch = trimmedLine.match(/^;s\[(\d+)\]\s*=\s*(.*)$/);
        if (speakerMatch) {
            const [, speakerId, quotedText] = speakerMatch;
            speakerMap.set(+speakerId, quotedText);
            currentSpeakerId = +speakerId;
            continue;
        }
        
        // Parse message line: ;m[129158] = "..."
        const messageMatch = trimmedLine.match(/^;m\[(\d+)\]/);
        if (messageMatch) {
            const [, lineNumber] = messageMatch;
            if (currentSpeakerId !== null) {
                messageToSpeaker.set(+lineNumber, currentSpeakerId);
            }
        }
    }
    
    return { speakerMap, messageToSpeaker };
};

// Add speakers to dialogue lines (like add_speakers.js)
const addSpeakersToDialogue = (dialogueLines, speakerMap, messageToSpeaker) => {
    const output = [];
    let lastSpeaker = null;
    
    for (const line of dialogueLines) {
        const match = line.match(/^m\[(\d+)\]\s*=\s*(.*)$/);
        if (match) {
            const [, lineNumber, quotedText] = match;
            const speakerId = messageToSpeaker.get(+lineNumber);
            
            if (speakerId !== undefined) {
                const speaker = speakerMap.get(speakerId);
                
                // Only add speaker line if speaker changed
                if (speaker && lastSpeaker !== speaker) {
                    // Add newline if speaker changed (except for first speaker)
                    if (lastSpeaker !== null) {
                        output.push("");
                    }
                    output.push(`;s[${speakerId}] = ${speaker}`);
                    lastSpeaker = speaker;
                }
            } else {
                // No speaker for this line, reset lastSpeaker
                lastSpeaker = null;
            }
        }
        output.push(line);
    }
    
    return output;
};

// Main
const main = async () => {
    console.log("Loading JSON data...");
    const v100AinJson = await fs.readFile("./Rance10.v1.00.ain.json", "utf-8");
    const v100AinData = JSON.parse(v100AinJson);

    const v104AinJson = await fs.readFile("./Rance10.v1.04.ain.json", "utf-8");
    const v104AinData = JSON.parse(v104AinJson);

    const cherryPicksTxt = await fs.readFile("./system_cherry_picks.v1.04.ain.txt", "utf-8");

    const [v100ToV104, unmapped] = mapLineNumbers(v100AinData, v104AinData);

    const ROOT_FOLDER_PATH_V1_00 = "./gpt_outputs";
    const ROOT_FOLDER_PATH_V1_04 = "./gpt_outputs_v104";

    const allLineRecordsV100 = await readTranslations(ROOT_FOLDER_PATH_V1_00);
    const allLineRecordsV104 = await readTranslations(ROOT_FOLDER_PATH_V1_04);

    console.log("Generating base Japanese dialogue file...");
    const baseDialogue = [...allLineRecordsV100
        .flatMap(lr => {
            const v104LineNumber = v100ToV104.get(+lr.lineNumber);
            if (!v104LineNumber) {
                return [];
            } else {
                return { ...lr, lineNumber: v104LineNumber };
            }
        })
        .concat(allLineRecordsV104)
        .reduce((acc, lr) => {
            acc.set(lr.lineNumber, lr);
            return acc;
        }, new Map())
        .values()]
        .map(lr => `m[${lr.lineNumber}] = ${JSON.stringify(lr.originalJapaneseLine)}`)
        .join("\n") + cherryPicksTxt + "\n";

    console.log("Loading speaker data from Rance10.v1.04.ain.txt...");
    const ainTxt = await fs.readFile("./Rance10.v1.04.ain.txt", "utf-8");
    const { speakerMap, messageToSpeaker } = parseSpeakerMapping(ainTxt);

    console.log("Adding speakers to Japanese dialogue...");
    const dialogueLines = baseDialogue.split("\n");
    const outputWithSpeakers = addSpeakersToDialogue(dialogueLines, speakerMap, messageToSpeaker);
    const output = outputWithSpeakers.join("\n");

    const outputPath = "regenerated_japanese.ain.txt";
    await fs.writeFile(outputPath, output, "utf-8");
    console.log(`Generated ${outputPath}`);
};

main().catch(error => {
    console.error("Error:", error);
    process.exit(1);
});
