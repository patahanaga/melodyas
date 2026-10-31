// --- 共通の描画処理関数（タイムライン絶対配置・小節番号ヘッダー付き） ---
function renderPianoRoll() {
    const scoreInput = document.getElementById('scoreInputArea').value;

    function parseCombinedScore(text) {
        let melodyLines = [];
        let chordLines = [];

        const lines = text.split(/\r?\n/);
        let currentBar = 0;

        for (let line of lines) {
            let trimmed = line.trim();
            if (!trimmed) continue;

            if (trimmed.startsWith('#')) {
                currentBar++;
                melodyLines.push(`#${currentBar}`);
                chordLines.push(`#${currentBar}`);
                continue;
            }

            if (trimmed.startsWith('ml:')) {
                const content = trimmed.substring(3).trim();
                melodyLines.push(content);
            } else if (trimmed.startsWith('ch:')) {
                const content = trimmed.substring(3).trim();
                chordLines.push(content);
            }
        }

        const melodyArray = convertMelodyToJsonString(melodyLines.join('\n'));
        const chordArray = convertChordToJsonString(chordLines.join('\n'));

        return { melodyArray, chordArray };
    }

    const { melodyArray, chordArray } = parseCombinedScore(scoreInput);
    const combinedArray = mergeMelodyAndChords(melodyArray, chordArray);

    // --- 縦軸（音名）の自動伸縮ロジック（最低1オクターブを確保） ---
    const pitchOrder = {
        "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, 
        "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, 
        "A#": 10, "Bb": 10, "B": 11,
        "C'": 12, "C#'": 13, "Db'": 13, "D'": 14, "D#'": 15, "Eb'": 15, "E'": 16,
        "F'": 17, "F#'": 18, "Gb'": 18, "G'": 19, "G#'": 20, "Ab'": 20, "A'": 21,
        "A#'": 22, "Bb'": 22, "B'": 23, "C''": 24
    };

    let minIdx = 12; // デフォルトC
    let maxIdx = 0;  // デフォルトC'
    let foundNotes = false;

    melodyArray.forEach(item => {
        if (item.ml && pitchOrder[item.ml] !== undefined) {
            const val = pitchOrder[item.ml];
            if (!foundNotes) {
                minIdx = val;
                maxIdx = val;
                foundNotes = true;
            } else {
                if (val < minIdx) minIdx = val;
                if (val > maxIdx) maxIdx = val;
            }
        }
    });

    if ((maxIdx - minIdx) < 12) {
        const center = Math.floor((minIdx + maxIdx) / 2);
        minIdx = Math.max(0, center - 6);
        maxIdx = Math.min(24, minIdx + 12);
    }

    let pitches = [];
    for (let i = 24; i >= 0; i--) {
        if (i >= minIdx && i <= maxIdx) {
            const foundPitch = Object.keys(pitchOrder).find(key => pitchOrder[key] === i);
            if (foundPitch) pitches.push(foundPitch);
        }
    }
    if (pitches.length === 0) {
        pitches = ["C'", "B", "A#", "A", "G#", "G", "F#", "F", "E", "D#", "D", "C#", "C"];
    }

    // --- タイムライン全体の幅を計算（全音符の最大終了時刻から算出） ---
    let maxTime = 9.0; // 最低2小節分（1.0〜9.0）
    melodyArray.forEach(item => {
        const endTime = Number(item.t) + Number(item.dur);
        if (endTime > maxTime) maxTime = endTime;
    });

    const BEAT_WIDTH = 60; // 💡 横幅を少し広げてゆったりさせました（必要に応じて調整してください）
    const totalBeats = maxTime - 1.0;
    const timelineWidth = totalBeats * BEAT_WIDTH;

    // --- ピアノロールの構造構築 ---
    const container = document.getElementById('pianoRoll');
    container.innerHTML = ''; 
    container.style.position = 'relative';
    container.style.width = (50 + timelineWidth) + 'px'; 

    // --- 1. 小節番号ヘッダー行の作成 ---
    const barHeaderWrapper = document.createElement('div');
    barHeaderWrapper.className = 'bar-header-row';
    barHeaderWrapper.style.display = 'flex';
    barHeaderWrapper.style.height = '24px';
    barHeaderWrapper.style.borderBottom = '2px solid #333344';
    barHeaderWrapper.style.backgroundColor = '#0a0a0c';

    const barHeaderLabel = document.createElement('div');
    barHeaderLabel.style.width = '50px';
    barHeaderLabel.style.flexShrink = '0';
    barHeaderLabel.style.borderRight = '1px solid #222228';
    barHeaderWrapper.appendChild(barHeaderLabel);

    const barHeaderTrack = document.createElement('div');
    barHeaderTrack.style.position = 'relative';
    barHeaderTrack.style.width = timelineWidth + 'px';
    barHeaderTrack.style.height = '24px';

    let currentBarNum = 1;
    for (let b = 1.0; b < maxTime; b += 4.0) {
        const leftPx = (b - 1.0) * BEAT_WIDTH;
        
        const barLabel = document.createElement('div');
        barLabel.style.position = 'absolute';
        barLabel.style.left = (leftPx + 6) + 'px';
        barLabel.style.top = '4px';
        barLabel.style.fontSize = '11px';
        barLabel.style.fontFamily = 'monospace';
        barLabel.style.color = '#888899';
        barLabel.style.fontWeight = 'bold';
        barLabel.textContent = `#${currentBarNum}`;
        
        barHeaderTrack.appendChild(barLabel);
        currentBarNum++;
    }
    barHeaderWrapper.appendChild(barHeaderTrack);
    container.appendChild(barHeaderWrapper);

    // --- 2. 各音名トラックの構築 ---
    pitches.forEach(pitch => {
        const rowWrapper = document.createElement('div');
        rowWrapper.className = 'piano-row';
        rowWrapper.style.display = 'flex';
        rowWrapper.style.height = '32px';
        rowWrapper.style.borderBottom = '1px solid #14141a';

        const label = document.createElement('div');
        label.className = 'row-label';
        label.textContent = pitch;
        label.style.width = '50px';
        label.style.flexShrink = '0';
        rowWrapper.appendChild(label);

        const track = document.createElement('div');
        track.className = 'track-area';
        track.dataset.pitch = pitch;
        track.style.position = 'relative';
        track.style.width = timelineWidth + 'px';
        track.style.height = '32px';
        track.style.backgroundColor = '#000000';

        // 拍線・小節線の描画
        for (let b = 0; b <= totalBeats; b += 0.5) {
            const line = document.createElement('div');
            line.style.position = 'absolute';
            line.style.left = (b * BEAT_WIDTH) + 'px';
            line.style.top = '0';
            line.style.bottom = '0';
            line.style.width = '1px';
            if (b % 4 === 0) {
                line.style.borderLeft = '2px solid #333344';
            } else {
                line.style.borderLeft = '1px solid #14141a';
            }
            track.appendChild(line);
        }

        rowWrapper.appendChild(track);
        container.appendChild(rowWrapper);
    });

    // 根音からの半音差に基づく厳密な相対位置計算
    function getRelativePosition(chord, melody) {
        if (!melody || !chord) return melody;
        
        const chordRootMatch = chord.match(/^[A-G](?:#|b)?/);
        if (!chordRootMatch) return melody;
        const rootNote = chordRootMatch[0];

        const melodyNoteMatch = melody.match(/^[A-G](?:#|b)?/);
        if (!melodyNoteMatch) return melody;
        const melodyNote = melodyNoteMatch[0];

        const semiMap = {
            'C': 0, 'B#': 0,
            'C#': 1, 'Db': 1,
            'D': 2,
            'D#': 3, 'Eb': 3,
            'E': 4, 'Fb': 4,
            'F': 5, 'E#': 5,
            'F#': 6, 'Gb': 6,
            'G': 7,
            'G#': 8, 'Ab': 8,
            'A': 9,
            'A#': 10, 'Bb': 10,
            'B': 11, 'Cb': 11
        };

        function getAbsoluteSemitone(noteStr) {
            let baseNote = noteStr.replace(/['"]/g, '');
            let octaveBonus = (noteStr.match(/['"]/g) || []).length * 12;
            if (noteStr.includes(',')) {
                octaveBonus -= 12 * (noteStr.match(/,/g) || []).length;
            }
            return (semiMap[baseNote] || 0) + octaveBonus;
        }

        const rootSemi = getAbsoluteSemitone(rootNote);
        const melodySemi = getAbsoluteSemitone(melodyNote);

        let diff = (melodySemi - rootSemi) % 12;
        if (diff < 0) diff += 12;

        const ruleTable = {
            0:  "1",
            1:  "1+",
            2:  "2",
            3:  "3",
            4:  "3",
            5:  "4",
            6:  "4+",
            7:  "5",
            8:  "5+",
            9:  "6",
            10: "7-",
            11: "7"
        };

        return ruleTable[diff] || melodyNote;
    }

    function getChordAtTime(t, combinedArray) {
        let currentChord = "";
        for (const item of combinedArray) {
            if (item.t <= t) {
                currentChord = item.ch;
            } else {
                break;
            }
        }
        return currentChord;
    }

    // --- メロディノートの分割・絶対配置描画 ---
    melodyArray.forEach(item => {
        const ml = item.ml;   
        const startT = Number(item.t);     
        const dur = Number(item.dur); 
        const endT = startT + dur;

        if (!ml) return; 

        const targetTrack = container.querySelector(`.track-area[data-pitch="${ml}"]`);
        if (!targetTrack) return;

        let splitPoints = [startT, endT];
        chordArray.forEach(cItem => {
            const cT = Number(cItem.t);
            if (cT > startT && cT < endT) {
                splitPoints.push(cT);
            }
        });
        splitPoints = Array.from(new Set(splitPoints)).sort((a, b) => a - b);

        for (let i = 0; i < splitPoints.length - 1; i++) {
            const segStart = splitPoints[i];
            const segEnd = splitPoints[i + 1];
            const segDur = segEnd - segStart;

            const leftPx = (segStart - 1.0) * BEAT_WIDTH;
            const widthPx = segDur * BEAT_WIDTH;

            const noteBlock = document.createElement('div');
            noteBlock.className = 'note-block-absolute';
            noteBlock.style.position = 'absolute';
            noteBlock.style.left = leftPx + 'px';
            noteBlock.style.top = '3px';
            noteBlock.style.width = widthPx + 'px';
            noteBlock.style.height = '26px';
            noteBlock.style.boxSizing = 'border-box';
            noteBlock.style.backgroundColor = '#000000';
            noteBlock.style.border = '2px solid #5a7d9a';
            noteBlock.style.color = '#d1d5db';
            noteBlock.style.display = 'flex';
            noteBlock.style.alignItems = 'center';
            noteBlock.style.justifyContent = 'center';
            noteBlock.style.fontWeight = 'bold';
            noteBlock.style.fontSize = '10px';
            noteBlock.style.zIndex = '2';
            noteBlock.style.overflow = 'hidden';
            noteBlock.style.whiteSpace = 'nowrap';

            let borderRadiusLeft = '13px';
            let borderRadiusRight = '13px';
            let borderLeftStyle = '2px solid #5a7d9a';
            let borderRightStyle = '2px solid #5a7d9a';

            if (i > 0) {
                borderRadiusLeft = '0px';
                borderLeftStyle = 'none'; 
            }
            if (i < splitPoints.length - 2) {
                borderRadiusRight = '0px';
                borderRightStyle = 'none';
            }

            noteBlock.style.borderTopLeftRadius = borderRadiusLeft;
            noteBlock.style.borderBottomLeftRadius = borderRadiusLeft;
            noteBlock.style.borderTopRightRadius = borderRadiusRight;
            noteBlock.style.borderBottomRightRadius = borderRadiusRight;
            noteBlock.style.borderLeft = borderLeftStyle;
            noteBlock.style.borderRight = borderRightStyle;

            const chordAtThisSeg = getChordAtTime(segStart, combinedArray);
            const currentText = getRelativePosition(chordAtThisSeg, ml);

            const baseNum = currentText.replace(/[^0-9]/g, '');
            if (["1", "3", "5"].includes(baseNum)) {
                noteBlock.style.borderColor = '#c2b280';
                if (i === 0 || borderLeftStyle !== 'none') {
                    noteBlock.style.borderLeftColor = '#c2b280';
                }
                noteBlock.style.color = '#ffffff';
            }

            noteBlock.textContent = currentText;
            targetTrack.appendChild(noteBlock);
        }
    });
}

document.getElementById('renderButton').addEventListener('click', renderPianoRoll);
renderPianoRoll();