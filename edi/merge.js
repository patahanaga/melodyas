function mergeMelodyAndChords(melodyArray, chordArray) {
    // 1. すべてのタイムスタンプ（音の開始・終了、コードの切り替わり点）を収集
    const timePointsSet = new Set();
    timePointsSet.add(1.0);

    if (Array.isArray(melodyArray)) {
        melodyArray.forEach(item => {
            const start = Number(item["t"]);
            const dur = Number(item["dur"] || 1.0);
            timePointsSet.add(start);
            timePointsSet.add(start + dur);
        });
    }

    if (Array.isArray(chordArray)) {
        chordArray.forEach(item => {
            timePointsSet.add(Number(item["t"]));
        });
    }

    const timePoints = Array.from(timePointsSet).sort((a, b) => a - b);

    // 2. コードのタイムライン（時刻 -> コード）を構築
    const chordMap = new Map();
    if (Array.isArray(chordArray)) {
        chordArray.forEach(item => {
            chordMap.set(Number(item["t"]), item["ch"]);
        });
    }

    let currentChord = "";
    const merged = [];

    // 3. 各タイムポイントで「その瞬間どのメロディー（音符 or 休符）が鳴っているか」を判定
    timePoints.forEach(t => {
        if (chordMap.has(t)) {
            currentChord = chordMap.get(t);
        }

        let activeMelody = ""; // デフォルトは休符（""）
        let activeBar = 1;
        let found = false;

        if (Array.isArray(melodyArray)) {
            for (const m of melodyArray) {
                const start = Number(m["t"]);
                const dur = Number(m["dur"] || 1.0);
                const end = start + dur;

                // t が [start, end) の範囲に含まれる場合
                if (start <= t && t < end) {
                    activeMelody = m["ml"]; // "C" や "" (休符) が入る
                    activeBar = m["#"] || 1;
                    found = true;
                    break;
                }
            }
        }

        // スコアの有効範囲内であれば、休符（""）であっても記録対象にする
        if (found) {
            merged.push({
                "#": activeBar,
                "t": Number(t.toFixed(3)),
                "ml": activeMelody,
                "ch": currentChord
            });
        }
    });

    // 4. 隣り合う要素で「時刻」「メロディー」「コード」のいずれかに変化がある場合のみ結果に採用
    const finalResult = [];
    let lastItem = null;

    merged.forEach(item => {
        if (!lastItem) {
            finalResult.push(item);
            lastItem = item;
        } else {
            if (lastItem["t"] !== item["t"] || lastItem["ml"] !== item["ml"] || lastItem["ch"] !== item["ch"]) {
                finalResult.push(item);
                lastItem = item;
            }
        }
    });

    return finalResult;
}