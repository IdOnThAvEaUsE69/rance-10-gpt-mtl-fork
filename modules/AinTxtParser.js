
function unquote(quoted) {
    return JSON.parse(quoted.replace(/\t/g, "\\t"));
}

/**
 * @param {string} ainTxt = `
 * ; activity::detail::CActivity@LoadActivity
 * ;s[8] = "アクティビティの読み込みに失敗しました【%s】"
 * ;m[63840] = "荒々しくハイパー兵器を捻り込んだ。"
 * `
 * @return {{
 *     unparsed: string[],
 *     parsed: {
 *         lineKind: "m" | "s",
 *         lineNumber: number,
 *         commented: boolean,
 *         originalJapaneseLine: "「なーーーーにを上から見下ろしてるかーーー！」" | string,
 *     }[],
 * }}
 */
export default function parseAin(ainTxt) {
    const unparsed = [];
    const parsed = [];

    const lines = ainTxt.split("\n");
    for (const line of lines) {
        const trimmedLine = line.trim().replace(/\r$/, '');
        if (!trimmedLine) {
            continue;
        }
        const match = trimmedLine.match(/^(;|)([ms])\[(\d+)]\s*=\s*(.*)$/);
        if (match) {
            const [, commented, lineKind, lineNumber, quotedText] = match;
            // Extract the quoted string - handle both properly quoted and malformed lines
            const quoteMatch = quotedText.match(/^"(.*)"$/);
            const originalJapaneseLine = quoteMatch ? JSON.parse(quotedText.replace(/\t/g, "\\t")) : quotedText;
            parsed.push({ lineKind, lineNumber: +lineNumber, commented: !!commented, originalJapaneseLine });
        } else {
            unparsed.push(line);
        }
    }

    return { parsed, unparsed };
}