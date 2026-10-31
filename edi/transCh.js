function convertChordToJsonString(text) {
    const result = [];
    const lines = text.split(/\r?\n/);
    
    let currentBar = 0; 
    let currentBarStartT = 1.0;

    const chordPattern = /^((?:[A-G](?:#|b)?['"]*)+)(\*\/\/|\*\/|\*|--|-)?(\.)?/;

    const durationMap = {
        '--': 4.0,   
        '-': 2.0,    
        '*': 1.0,    
        '*/': 0.5,   
        '*//': 0.25  
    };

    for (let line of lines) {
        let trimmed = line.trim();
        if (!trimmed) continue;

        if (trimmed.startsWith('#')) {
            currentBar++;
            if (currentBar > 1) {
                currentBarStartT += 4.0;
            }
            
            const afterHash = trimmed.substring(1);
            const noteStartIdx = afterHash.search(/[A-G]/);
            if (noteStartIdx !== -1) {
                trimmed = afterHash.substring(noteStartIdx);
            } else {
                continue;
            }
        }

        let cursor = 0;
        let chordOffsetInBar = 0.0;

        while (cursor < trimmed.length) {
            if (/\s/.test(trimmed[cursor])) {
                cursor++;
                continue;
            }

            const substring = trimmed.substring(cursor);
            const match = substring.match(chordPattern);

            if (match) {
                const chordStr = match[1];     
                const lengthKey = match[2] || '*'; 
                const hasDot = match[3];        

                let duration = durationMap[lengthKey] || 1.0;
                if (hasDot) {
                    duration *= 1.5;
                }

                const absoluteT = currentBarStartT + chordOffsetInBar;

                result.push({
                    "#": currentBar,
                    "t": Number(absoluteT.toFixed(3)),
                    "dur": Number(duration.toFixed(3)),
                    "ch": chordStr
                });

                chordOffsetInBar += duration;
                cursor += match[0].length;
            } else {
                cursor++;
            }
        }
    }

    return result;
}