let cageComboStates = {};

document.addEventListener('DOMContentLoaded', () => {
    const board = document.getElementById('sudoku-board');
    const comboContainer = document.getElementById('combo-buttons-container');
    const calcDisplay = document.getElementById('calc-display');
    const modeBtn = document.getElementById('mode-btn');
    const fillBtn = document.getElementById('fill-btn');
    const delBtn = document.getElementById('del-btn');
    const undoBtn = document.getElementById('undo-btn');
    const timerDisplay = document.getElementById('timer');
    const restartBtn = document.getElementById('restart-btn');
    const checkBtn = document.getElementById('check-btn');

    let selectedIndices = [];
    let draggingIndices = new Set();
    let isDragging = false;
    let startIdx = null;
    let inputMode = 'normal';
    let isChecking = false;

    let historyStack = [];
    let cellsData = [];
    let secondsElapsed = 0;
    let timerInterval = null;

    const gen = new SudokuGenerator();
    const puzzle = gen.getPuzzle();

    // --- 计时器 ---
    function startTimer() {
        if (timerInterval) clearInterval(timerInterval);
        secondsElapsed = 0;
        updateTimerDisplay();
        timerInterval = setInterval(() => {
            secondsElapsed++;
            updateTimerDisplay();
        }, 1000);
    }

    function updateTimerDisplay() {
        const mins = Math.floor(secondsElapsed / 60);
        const secs = secondsElapsed % 60;
        timerDisplay.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // --- 正确性检测 (Check 按钮) ---
    function toggleCheckMode() {
        isChecking = !isChecking;
        if (isChecking) {
            cellsData.forEach((data, i) => {
                const cell = board.children[i];
                if (data.value !== "" && parseInt(data.value) !== puzzle.solution[i]) {
                    cell.classList.add('error-highlight');
                }
            });
            checkBtn.innerText = "Hide";
            checkBtn.classList.add('active');
        } else {
            resetCheckUI();
        }
    }

    function resetCheckUI() {
        isChecking = false;
        checkBtn.innerText = "Check";
        checkBtn.classList.remove('active');
        Array.from(board.children).forEach(cell => cell.classList.remove('error-highlight'));
    }

    // --- 胜负判定 ---
    function checkWinCondition() {
        const isFull = cellsData.every(d => d.value !== '');
        if (!isFull) return;
        const isCorrect = cellsData.every((d, i) => parseInt(d.value) === puzzle.solution[i]);
        if (timerInterval) clearInterval(timerInterval);
        setTimeout(() => {
            if (isCorrect) alert(`🎉 Congratulations! Solved in ${timerDisplay.innerText}!`);
            else alert("The board is full, but some numbers are wrong. Keep trying!");
        }, 200);
    }

    function getCageId(cage) {
        if (!cage) return null;
        return cage.cells.slice().sort((a, b) => a - b).join('-');
    }

    function saveSnapshot() {
        const snapshot = {
            board: cellsData.map(d => ({ value: d.value, notes: new Set(d.notes) })),
            combos: JSON.parse(JSON.stringify(cageComboStates)),
            selection: [...selectedIndices]
        };
        historyStack.push(snapshot);
        if (historyStack.length > 100) historyStack.shift();
        updateUndoButtonState();
    }

    function updateUndoButtonState() {
        if (!undoBtn) return;
        undoBtn.style.opacity = historyStack.length === 0 ? "0.3" : "1";
        undoBtn.style.pointerEvents = historyStack.length === 0 ? "none" : "auto";
    }

    function initUI() {
        board.innerHTML = '';
        cellsData = [];
        for (let i = 0; i < 81; i++) {
            cellsData.push({ value: '', notes: new Set() });
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.index = i;
            const r = Math.floor(i / 9), c = i % 9;
            if ((c + 1) % 3 === 0 && c !== 8) cell.classList.add('thick-right');
            if ((r + 1) % 3 === 0 && r !== 8) cell.classList.add('thick-bottom');
            cell.innerHTML = `<span class="cell-value"></span><div class="notes-container">${
                Array.from({length:9}, (_,idx)=>`<div class="note-digit">${idx+1}</div>`).join('')
            }</div>`;

            cell.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                board.setPointerCapture(e.pointerId);
                isDragging = true;
                startIdx = i;
                draggingIndices.clear();
                draggingIndices.add(i);
                clearHighlights();
                cell.classList.add('selected');
                if (isChecking) resetCheckUI(); 
            });
            board.appendChild(cell);
        }

        board.addEventListener('pointermove', (e) => {
            if (!isDragging) return;
            const target = document.elementFromPoint(e.clientX, e.clientY);
            const cell = target?.closest('.cell');
            if (cell) {
                const idx = parseInt(cell.dataset.index);
                if (!draggingIndices.has(idx)) {
                    draggingIndices.add(idx);
                    updateScanningUI();
                }
            }
        });

        board.addEventListener('pointerup', (e) => {
            if (!isDragging) return;
            isDragging = false;
            board.releasePointerCapture(e.pointerId);
            if (draggingIndices.size === 1 && draggingIndices.has(startIdx)) {
                selectedIndices = [startIdx];
                showSingleSelection(startIdx);
            } else {
                selectedIndices = Array.from(draggingIndices);
                updateScanningUI();
            }
        });
        renderCages();
    }

    function refreshUI() {
        cellsData.forEach((data, i) => {
            const cell = board.children[i];
            cell.querySelector('.cell-value').innerText = data.value;
            const notes = cell.querySelectorAll('.note-digit');
            notes.forEach((n, idx) => n.classList.toggle('visible', data.notes.has(idx + 1)));
        });
        checkWinCondition();
    }

    function renderCages() {
        puzzle.cages.forEach(cage => {
            const first = Math.min(...cage.cells);
            cage.cells.forEach(idx => {
                const line = document.createElement('div');
                line.classList.add('cage-line');
                if (!cage.cells.includes(idx-9)) line.classList.add('b-top'); else line.classList.add('in-top');
                if (!cage.cells.includes(idx+9)) line.classList.add('b-bottom'); else line.classList.add('in-bottom');
                if (!cage.cells.includes(idx-1) || idx%9===0) line.classList.add('b-left'); else line.classList.add('in-left');
                if (!cage.cells.includes(idx+1) || idx%9===8) line.classList.add('b-right'); else line.classList.add('in-right');
                if (idx === first) {
                    const s = document.createElement('div');
                    s.classList.add('cage-sum'); s.innerText = cage.targetSum;
                    line.appendChild(s);
                }
                board.children[idx].appendChild(line);
            });
        });
    }

    function clearHighlights() {
        Array.from(board.children).forEach(c => 
            c.classList.remove('selected', 'highlighted', 'drag-scanning', 'cage-complete', 'error-highlight', 'same-number-highlight', 'conflict-highlight'));
    }

    function updateScanningUI() {
        clearHighlights();
        draggingIndices.forEach(idx => board.children[idx].classList.add('drag-scanning'));
        checkCages(Array.from(draggingIndices));
    }

    function showSingleSelection(idx) {
        clearHighlights();
        const r = Math.floor(idx / 9), c = idx % 9;
        const targetValue = cellsData[idx].value;
        const cage = puzzle.cages.find(cg => cg.cells.includes(idx));
        
        Array.from(board.children).forEach((cell, i) => {
            const ri = Math.floor(i / 9), ci = i % 9;
            const currentData = cellsData[i];
            const isRel = ri === r || ci === c || (Math.floor(ri / 3) === Math.floor(r / 3) && Math.floor(ci / 3) === Math.floor(c / 3)) || (cage && cage.cells.includes(i));
            
            if (i === idx) cell.classList.add('selected');
            else if (isRel) cell.classList.add('highlighted');

            // 逻辑 1：相同数字高亮
            if (targetValue !== "" && currentData.value === targetValue && i !== idx) {
                cell.classList.add('same-number-highlight');
            }

            // 逻辑 2：冲突高亮 (重点修改部分)
            if (currentData.value !== "" && isRel && currentData.value === targetValue && i !== idx) {
                cell.classList.add('conflict-highlight');
                board.children[idx].classList.add('conflict-highlight');
            }
        });
        renderCombos(cage);
    }

    function checkCages(ids) {
        const involved = puzzle.cages.filter(cg => cg.cells.some(id => ids.includes(id)));
        const full = involved.filter(cg => cg.cells.every(id => ids.includes(id)));
        if (full.reduce((a, b) => a + b.cells.length, 0) === ids.length && ids.length > 0) {
            calcDisplay.innerText = full.reduce((a, b) => a + b.targetSum, 0);
            ids.forEach(idx => board.children[idx].classList.add('cage-complete'));
        } else {
            calcDisplay.innerText = "0";
            renderCombos(null);
        }
    }

    function renderCombos(cage) {
        comboContainer.innerHTML = '';
        if (!cage) return;
        calcDisplay.innerText = cage.targetSum;
        const cageId = getCageId(cage);
        if (!cageComboStates[cageId]) cageComboStates[cageId] = [];
        getCombos(cage.targetSum, cage.cells.length).slice(0, 12).forEach((cb, idx) => {
            const btn = document.createElement('div');
            btn.className = 'combo-btn';
            if (cageComboStates[cageId][idx]) btn.classList.add('disabled');
            btn.innerText = ` ${cb.join(' ')} `;
            btn.addEventListener('pointerup', (e) => {
                e.stopPropagation(); saveSnapshot();
                btn.classList.toggle('disabled');
                cageComboStates[cageId][idx] = btn.classList.contains('disabled');
            });
            comboContainer.appendChild(btn);
        });
    }

    function getCombos(t, n, s=1, cur=[]) {
        if (t===0 && cur.length===n) return [cur];
        if (t<0 || cur.length===n) return [];
        let res = [];
        for (let i=s; i<=9; i++) res = res.concat(getCombos(t-i, n, i+1, [...cur, i]));
        return res;
    }

    function cleanRelatedNotes(idx, num) {
        const r = Math.floor(idx / 9), c = idx % 9;
        const cage = puzzle.cages.find(cg => cg.cells.includes(idx));
        const affected = new Set();
        for (let i = 0; i < 81; i++) {
            if (i === idx) continue;
            const isRel = (Math.floor(i/9)===r || i%9===c || (Math.floor(Math.floor(i/9)/3)===Math.floor(r/3) && Math.floor((i%9)/3)===Math.floor(c/3)) || (cage && cage.cells.includes(i)));
            if (isRel && cellsData[i].notes.has(num)) {
                cellsData[i].notes.delete(num);
                affected.add(i);
            }
        }
        affected.forEach(ti => {
            if (cellsData[ti].value === '' && cellsData[ti].notes.size === 1) {
                const ln = Array.from(cellsData[ti].notes)[0];
                cellsData[ti].value = ln.toString(); cellsData[ti].notes.clear();
                cleanRelatedNotes(ti, ln);
            }
        });
    }

    restartBtn.addEventListener('pointerup', () => {
        if (!confirm("Restart?")) return;
        cellsData.forEach(d => { d.value = ''; d.notes.clear(); });
        cageComboStates = {}; historyStack = []; selectedIndices = [];
        refreshUI(); clearHighlights(); updateUndoButtonState();
        calcDisplay.innerText = "0"; comboContainer.innerHTML = '';
        startTimer();
    });

    checkBtn.addEventListener('pointerup', toggleCheckMode);

    fillBtn.addEventListener('pointerup', () => {
        saveSnapshot();
        selectedIndices.forEach(idx => {
            const cage = puzzle.cages.find(c => c.cells.includes(idx));
            if (cage) {
                cellsData[idx].value = ''; 
                getCombos(cage.targetSum, cage.cells.length).forEach(c => c.forEach(d => cellsData[idx].notes.add(d)));
            }
        });
        refreshUI();
        if (selectedIndices.length === 1) showSingleSelection(selectedIndices[0]);
    });

    document.querySelectorAll('.num-key').forEach(btn => {
        btn.addEventListener('pointerup', () => {
            if (isChecking) resetCheckUI();
            saveSnapshot(); 
            const val = btn.innerText;
            const num = parseInt(val);
            selectedIndices.forEach(idx => {
                if (inputMode === 'normal') {
                    if (cellsData[idx].value === val) cellsData[idx].value = '';
                    else { cellsData[idx].value = val; cellsData[idx].notes.clear(); cleanRelatedNotes(idx, num); }
                } else {
                    if (cellsData[idx].value !== '') cellsData[idx].value = '';
                    if (cellsData[idx].notes.has(num)) cellsData[idx].notes.delete(num);
                    else cellsData[idx].notes.add(num);
                }
            });
            refreshUI(); 
            if (selectedIndices.length === 1) showSingleSelection(selectedIndices[0]);
        });
    });

    modeBtn.addEventListener('pointerup', () => {
        inputMode = (inputMode === 'normal' ? 'note' : 'normal');
        modeBtn.innerText = (inputMode === 'normal' ? 'NUM' : 'NOTE');
        modeBtn.className = `mode-${inputMode}`;
    });

    undoBtn.addEventListener('pointerup', () => {
        if (historyStack.length === 0) return;
        const last = historyStack.pop();
        cellsData = last.board.map(d => ({ value: d.value, notes: new Set(d.notes) }));
        cageComboStates = last.combos;
        selectedIndices = last.selection || [];
        refreshUI();
        if (selectedIndices.length === 1) showSingleSelection(selectedIndices[0]);
        else if (selectedIndices.length > 1) updateScanningUI();
        updateUndoButtonState();
    });

    delBtn.addEventListener('pointerup', () => {
        if (selectedIndices.length === 0) return;
        saveSnapshot(); 
        selectedIndices.forEach(idx => { cellsData[idx].value = ''; cellsData[idx].notes.clear(); });
        refreshUI();
        if (selectedIndices.length === 1) showSingleSelection(selectedIndices[0]);
    });

    initUI();
    startTimer();
});