function convertMelodyToJsonString(text) {
    const result = [];
    const lines = text.split(/\r?\n/);
    
    let currentBar = 0; 
    let currentBarStartT = 1.0; // 小節ごとの開始時刻（1小節は4.0拍と仮定）

    const notePattern = /^(3)?([A-G](?:#|b)?|z)(['"]*)(\*\/\/|\*\/|\*|--|-)?(\.)?(3)?/;

    const baseDurationMap = {
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
            // 2小節目以降は、前の小節の開始位置に 4.0 を足していく（4拍子基準）
            if (currentBar > 1) {
                currentBarStartT += 4.0;
            }
            
            const afterHash = trimmed.substring(1);
            const noteStartIdx = afterHash.search(/[A-Gz3]/);
            if (noteStartIdx !== -1) {
                trimmed = afterHash.substring(noteStartIdx);
            } else {
                continue;
            }
        }

        let cursor = 0;
        let noteOffsetInBar = 0.0; // 小節内での経過時間

        while (cursor < trimmed.length) {
            if (/\s/.test(trimmed[cursor])) {
                cursor++;
                continue;
            }

            const substring = trimmed.substring(cursor);
            const match = substring.match(notePattern);

            if (match) {
                const hasFront3 = match[1];     
                const tokenType = match[2];     
                const octave = match[3];        
                const lengthKey = match[4] || '*'; 
                const hasDot = match[5];        
                const hasBack3 = match[6];      

                let duration = baseDurationMap[lengthKey] || 1.0;

                if (hasDot) {
                    duration *= 1.5;
                }

                if (hasFront3 || hasBack3) {
                    duration = duration * (2.0 / 3.0);
                }

                let melodyStr = "";
                if (tokenType !== 'z') {
                    melodyStr = tokenType + octave; 
                }

                const absoluteT = currentBarStartT + noteOffsetInBar;

                result.push({
                    "#": currentBar,
                    "t": Number(absoluteT.toFixed(3)),
                    "dur": Number(duration.toFixed(3)),
                    "ml": melodyStr,
                    "ch": ""
                });

                noteOffsetInBar += duration;
                cursor += match[0].length;
            } else {
                cursor++;
            }
        }
    }

    return result;
}