// --- 共通の描画処理関数（マルチ行・システム折り返し・根音背景ハイライト付き） ---
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

    let minIdx = 12; 
    let maxIdx = 0;  
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

    // --- 最大小節数の算出 ---
    let maxBar = 1;
    melodyArray.forEach(item => {
        const bar = Math.floor((Number(item.t) - 1.0) / 4.0) + 1;
        if (bar > maxBar) maxBar = bar;
    });
    chordArray.forEach(item => {
        const bar = Math.floor((Number(item.t) - 1.0) / 4.0) + 1;
        if (bar > maxBar) maxBar = bar;
    });

    // --- レイアウトパラメータ ---
    const BARS_PER_SYSTEM = 4; // 1行あたり4小節
    const BEAT_WIDTH = 60;     // 1拍あたりのピクセル幅
    const BEATS_PER_BAR = 4.0;
    const SYSTEM_BEATS = BARS_PER_SYSTEM * BEATS_PER_BAR; 
    const systemWidth = SYSTEM_BEATS * BEAT_WIDTH;

    const container = document.getElementById('pianoRoll');
    container.innerHTML = ''; 
    container.style.position = 'relative';
    container.style.width = '100%';
    container.style.maxWidth = (50 + systemWidth) + 'px';

    const totalSystems = Math.ceil(maxBar / BARS_PER_SYSTEM);

    // 根音取得および相対位置計算ヘルパー
    function getChordRoot(chord) {
        if (!chord) return null;
        const match = chord.match(/^[A-G](?:#|b)?/);
        return match ? match[0] : null;
    }

    function getRelativePosition(chord, melody) {
        if (!melody || !chord) return melody;
        const rootNote = getChordRoot(chord);
        if (!rootNote) return melody;

        const melodyNoteMatch = melody.match(/^[A-G](?:#|b)?/);
        if (!melodyNoteMatch) return melody;
        const melodyNote = melodyNoteMatch[0];

        const semiMap = {
            'C': 0, 'B#': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
            'E': 4, 'Fb': 4, 'F': 5, 'E#': 5, 'F#': 6, 'Gb': 6, 'G': 7,
            'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11, 'Cb': 11
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
            0: "1", 1: "1+", 2: "2", 3: "3", 4: "3",
            5: "4", 6: "4+", 7: "5", 8: "5+", 9: "6", 10: "7-", 11: "7"
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

    // --- システム（行）ごとに構築 ---
    for (let sysIdx = 0; sysIdx < totalSystems; sysIdx++) {
        const sysStartBar = sysIdx * BARS_PER_SYSTEM + 1;
        const sysEndBar = Math.min((sysIdx + 1) * BARS_PER_SYSTEM, maxBar);
        const sysStartTime = 1.0 + (sysStartBar - 1) * BEATS_PER_BAR;
        const sysEndTime = 1.0 + sysEndBar * BEATS_PER_BAR;

        const systemWrapper = document.createElement('div');
        systemWrapper.className = 'piano-system';
        systemWrapper.style.marginBottom = '24px';
        systemWrapper.style.border = '1px solid #222228';
        systemWrapper.style.backgroundColor = '#1a1a22';
        systemWrapper.style.borderRadius = '4px';
        systemWrapper.style.overflow = 'hidden';

        // 1. 小節番号ヘッダー行
        const barHeaderWrapper = document.createElement('div');
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
        barHeaderTrack.style.width = systemWidth + 'px';
        barHeaderTrack.style.height = '24px';

        for (let bBar = sysStartBar; bBar <= sysEndBar; bBar++) {
            const bTime = 1.0 + (bBar - 1) * BEATS_PER_BAR;
            const leftPx = (bTime - sysStartTime) * BEAT_WIDTH;

            const barLabel = document.createElement('div');
            barLabel.style.position = 'absolute';
            barLabel.style.left = (leftPx + 6) + 'px';
            barLabel.style.top = '4px';
            barLabel.style.fontSize = '11px';
            barLabel.style.fontFamily = 'monospace';
            barLabel.style.color = '#888899';
            barLabel.style.fontWeight = 'bold';
            barLabel.textContent = `#${bBar}`;
            barHeaderTrack.appendChild(barLabel);
        }
        barHeaderWrapper.appendChild(barHeaderTrack);
        systemWrapper.appendChild(barHeaderWrapper);

        const systemTracks = {};

        pitches.forEach(pitch => {
            const rowWrapper = document.createElement('div');
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
            track.style.position = 'relative';
            track.style.width = systemWidth + 'px';
            track.style.height = '32px';
            track.style.backgroundColor = '#000000';

            // 拍線・小節線の描画
            for (let b = 0; b <= SYSTEM_BEATS; b += 0.5) {
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
            systemWrapper.appendChild(rowWrapper);
            systemTracks[pitch] = track;
        });

        // --- 2. コードの根音（ルート）に基づく薄い背景ハイライトの描画 ---
        chordArray.forEach(cItem => {
            const startT = Number(cItem.t);
            const dur = Number(cItem.dur || 1.0);
            const endT = startT + dur;

            if (endT <= sysStartTime || startT >= sysEndTime) return;

            const rootNote = getChordRoot(cItem.ch);
            if (!rootNote) return;

            // 該当するオクターブ表現も含めて一致するトラックを探すか、ベースの音名が一致するトラックに薄い帯を引く
            // ここではピッチ名（例: "C", "C#" など）が一致するすべてのオクターブトラック、または完全一致を探す
            Object.keys(systemTracks).forEach(pitch => {
                // ピッチ名からオクターブ記号を除いた部分（例: "C'" -> "C"）を比較
                const basePitchName = pitch.replace(/['",]/g, '');
                if (basePitchName === rootNote) {
                    const drawStartT = Math.max(startT, sysStartTime);
                    const drawEndT = Math.min(endT, sysEndTime);
                    const segDur = drawEndT - drawStartT;

                    if (segDur > 0) {
                        const leftPx = (drawStartT - sysStartTime) * BEAT_WIDTH;
                        const widthPx = segDur * BEAT_WIDTH;

                        const rootBg = document.createElement('div');
                        rootBg.style.position = 'absolute';
                        rootBg.style.left = leftPx + 'px';
                        rootBg.style.top = '0px';
                        rootBg.style.width = widthPx + 'px';
                        rootBg.style.height = '32px';
                        // 💡 薄い塗りつぶしデザイン（サンドベージュ系やゴールド系の半透明）
                        rootBg.style.backgroundColor = 'rgba(194, 178, 128, 0.12)';
                        rootBg.style.borderLeft = '1px dashed rgba(194, 178, 128, 0.3)';
                        rootBg.style.borderRight = '1px dashed rgba(194, 178, 128, 0.3)';
                        rootBg.style.zIndex = '1'; // 拍線の上、メロディノート（z-index: 2）の下に配置
                        rootBg.style.pointerEvents = 'none';

                        systemTracks[pitch].appendChild(rootBg);
                    }
                }
            });
        });

        // --- 3. メロディノートの描画 ---
        melodyArray.forEach(item => {
            const ml = item.ml;   
            const startT = Number(item.t);     
            const dur = Number(item.dur); 
            const endT = startT + dur;

            if (endT <= sysStartTime || startT >= sysEndTime) return;
            if (!ml) return;

            const targetTrack = systemTracks[ml];
            if (!targetTrack) return;

            const drawStartT = Math.max(startT, sysStartTime);
            const drawEndT = Math.min(endT, sysEndTime);

            let splitPoints = [drawStartT, drawEndT];
            chordArray.forEach(cItem => {
                const cT = Number(cItem.t);
                if (cT > drawStartT && cT < drawEndT) {
                    splitPoints.push(cT);
                }
            });
            splitPoints = Array.from(new Set(splitPoints)).sort((a, b) => a - b);

            for (let i = 0; i < splitPoints.length - 1; i++) {
                const segStart = splitPoints[i];
                const segEnd = splitPoints[i + 1];
                const segDur = segEnd - segStart;

                const leftPx = (segStart - sysStartTime) * BEAT_WIDTH;
                const widthPx = segDur * BEAT_WIDTH;

                const noteBlock = document.createElement('div');
                noteBlock.className = 'note-block-absolute';
                noteBlock.style.position = 'absolute';
                noteBlock.style.left = leftPx + 'px';
                noteBlock.style.top = '3px';
                noteBlock.style.width = widthPx + 'px';
                noteBlock.style.height = '26px';
                noteBlock.style.boxSizing = 'border-box';
                noteBlock.style.backgroundColor = 'rgba(0, 0, 0, 0.0)';
                noteBlock.style.border = '2px solid #5a7d9a';
                noteBlock.style.color = '#d1d5db';
                noteBlock.style.display = 'flex';
                noteBlock.style.alignItems = 'center';
                noteBlock.style.justifyContent = 'center';
                noteBlock.style.fontWeight = 'bold';
                noteBlock.style.fontSize = '10px';
                noteBlock.style.zIndex = '2'; // ノートは背景より手前に表示
                noteBlock.style.overflow = 'hidden';
                noteBlock.style.whiteSpace = 'nowrap';

                let borderRadiusLeft = '13px';
                let borderRadiusRight = '13px';
                let borderLeftStyle = '2px solid #5a7d9a';
                let borderRightStyle = '2px solid #5a7d9a';

                if (i > 0 || segStart > startT) {
                    borderRadiusLeft = '0px';
                    borderLeftStyle = 'none'; 
                }
                if (i < splitPoints.length - 2 || segEnd < endT) {
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
                    if (i === 0 && segStart === startT) {
                        noteBlock.style.borderLeftColor = '#c2b280';
                    }
                    noteBlock.style.color = '#ffffff';
                }

                noteBlock.textContent = currentText;
                targetTrack.appendChild(noteBlock);
            }
        });

        container.appendChild(systemWrapper);
    }
}

document.getElementById('renderButton').addEventListener('click', renderPianoRoll);
renderPianoRoll();