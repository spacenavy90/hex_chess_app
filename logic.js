const canvas = document.getElementById('hex-canvas');
const ctx = canvas.getContext('2d');
const elements = {
    flipBtn: document.getElementById('flip-btn'),
    status: document.getElementById('status'),
    turn: document.getElementById('turn-display'),
    hover: document.getElementById('hover-coord'),
    mode: document.getElementById('mode-select'),
    timeControl: document.getElementById('time-control'),
    undo: document.getElementById('undo-btn'),
    redo: document.getElementById('redo-btn'),
    reset: document.getElementById('reset-btn'),
    fen: document.getElementById('fen-btn'),
    wResign: document.getElementById('w-resign-btn'),
    bResign: document.getElementById('b-resign-btn'),
    wDraw: document.getElementById('w-draw-btn'),
    bDraw: document.getElementById('b-draw-btn'),
    moveList: document.getElementById('move-list')
};

// State
let whiteTime = 600, blackTime = 600, increment = 0, timerInterval = null;
let isTimerRunning = false, isUnlimited = false, hasGameStarted = false;
let isFlipped = false, hexSize = 25, currentTurn = 'w';
let hoveredHex = null, selectedHex = null, validMoves = [], enPassantTarget = null, pendingPromotion = null;
let moveCount = 1, halfMoveClock = 0, currentHistoryIndex = -1;
let lastMove = { from: null, to: null };
let captures = { w: [], b: [] };
let gameMode = 'hotseat', aiSide = null;

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'k', 'l'];
const boardState = new Map();
let positionHistory = new Map(), stateHistory = [];

const colors = ['#b58863', '#8b5a2b', '#f0d9b5'];
const BOARD_LABELS = [
    { text: 'a', hex: 'a1', xOff: 0, yOff: 1.5 }, { text: 'b', hex: 'b1', xOff: 0, yOff: 1.5 }, { text: 'c', hex: 'c1', xOff: 0, yOff: 1.5 },
    { text: 'd', hex: 'd1', xOff: 0, yOff: 1.5 }, { text: 'e', hex: 'e1', xOff: 0, yOff: 1.5 }, { text: 'f', hex: 'f1', xOff: 0, yOff: 1.7 },
    { text: 'g', hex: 'g1', xOff: 0, yOff: 1.5 }, { text: 'h', hex: 'h1', xOff: 0, yOff: 1.5 }, { text: 'i', hex: 'i1', xOff: 0, yOff: 1.5 },
    { text: 'k', hex: 'k1', xOff: 0, yOff: 1.5 }, { text: 'l', hex: 'l1', xOff: 0, yOff: 1.5 },
    { text: '1', hex: 'a1', xOff: -1.2, yOff: -0.6 }, { text: '2', hex: 'a2', xOff: -1.2, yOff: -0.6 }, { text: '3', hex: 'a3', xOff: -1.2, yOff: -0.6 },
    { text: '4', hex: 'a4', xOff: -1.2, yOff: -0.6 }, { text: '5', hex: 'a5', xOff: -1.2, yOff: -0.6 }, { text: '6', hex: 'a6', xOff: -1.2, yOff: -0.6 },
    { text: '7', hex: 'b7', xOff: -1.2, yOff: -0.6 }, { text: '8', hex: 'c8', xOff: -1.2, yOff: -0.6 }, { text: '9', hex: 'd9', xOff: -1.2, yOff: -0.6 },
    { text: '10', hex: 'e10', xOff: -1.2, yOff: -0.6 }, { text: '11', hex: 'f11', xOff: -1.2, yOff: -0.6 },
    { text: '1', hex: 'l1', xOff: 1.2, yOff: -0.6 }, { text: '2', hex: 'l2', xOff: 1.2, yOff: -0.6 }, { text: '3', hex: 'l3', xOff: 1.2, yOff: -0.6 },
    { text: '4', hex: 'l4', xOff: 1.2, yOff: -0.6 }, { text: '5', hex: 'l5', xOff: 1.2, yOff: -0.6 }, { text: '6', hex: 'l6', xOff: 1.2, yOff: -0.6 },
    { text: '7', hex: 'k7', xOff: 1.2, yOff: -0.6 }, { text: '8', hex: 'i8', xOff: 1.2, yOff: -0.6 }, { text: '9', hex: 'h9', xOff: 1.2, yOff: -0.6 },
    { text: '10', hex: 'g10', xOff: 1.2, yOff: -0.6 }, { text: '11', hex: 'f11', xOff: 1.2, yOff: -0.6 }
];

const DIRS = {
    rook: [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]],
    bishop: [[2, -1], [1, 1], [-1, 2], [-2, 1], [-1, -1], [1, -2]],
    knight: [[1, -3], [2, -3], [3, -2], [3, -1], [2, 1], [1, 2], [-1, 3], [-2, 3], [-3, 2], [-3, 1], [-2, -1], [-1, -2]]
};

// Audio
let audioCtx = null;
function playSound(type) {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const p = {
        'move': { t: 'sine', f1: 400, f2: 100, dur: 0.1, vol: 0.3, ramp: 'exponentialRampToValueAtTime' },
        'capture': { t: 'square', f1: 150, f2: 50, dur: 0.15, vol: 0.3, ramp: 'exponentialRampToValueAtTime' },
        'end': { t: 'triangle', f1: 300, f2: 200, dur: 0.5, vol: 0.5, ramp: 'linearRampToValueAtTime' }
    }[type];
    if (!p) return;

    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain(), now = audioCtx.currentTime;
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.type = p.t;
    osc.frequency.setValueAtTime(p.f1, now);
    osc.frequency[p.ramp](p.f2, now + p.dur);
    gain.gain.setValueAtTime(p.vol, now);
    gain.gain[p.ramp](0.01, now + p.dur);
    osc.start(now); osc.stop(now + p.dur);
}

// UI & Listeners
elements.mode.addEventListener('change', (e) => {
    gameMode = e.target.value;
    aiSide = gameMode === 'ai-black' ? 'b' : (gameMode === 'ai-white' ? 'w' : null);
    if (currentTurn === aiSide) requestAiMove();
    updateStatus(`Mode: ${gameMode.replace('-', ' ')}`);
});

function updateStatus(message) {
    elements.turn.innerText = `${currentTurn === 'w' ? 'White' : 'Black'} to move`; 
    elements.status.innerText = message;
}

elements.wResign.addEventListener('click', () => triggerGameOver("White Resigns", "Black wins."));
elements.bResign.addEventListener('click', () => triggerGameOver("Black Resigns", "White wins."));
elements.wDraw.addEventListener('click', () => confirm("White offers a draw. Does Black accept?") && triggerGameOver("Draw", "By mutual agreement."));
elements.bDraw.addEventListener('click', () => confirm("Black offers a draw. Does White accept?") && triggerGameOver("Draw", "By mutual agreement."));
elements.undo.addEventListener('click', () => { if (currentHistoryIndex > 0) loadState(--currentHistoryIndex); });
elements.redo.addEventListener('click', () => { if (currentHistoryIndex < stateHistory.length - 1) loadState(++currentHistoryIndex); });
elements.reset.addEventListener('click', () => confirm("Are you sure you want to restart the game?") && resetGame());
elements.flipBtn.addEventListener('click', () => { isFlipped = !isFlipped; drawBoard(); });

function saveState() {
    if (currentHistoryIndex < stateHistory.length - 1) stateHistory = stateHistory.slice(0, currentHistoryIndex + 1);
    stateHistory.push({
        board: new Map(Array.from(boardState.entries()).map(([k, v]) => [k, { ...v }])),
        turn: currentTurn, epTarget: enPassantTarget, halfClock: halfMoveClock, moveCnt: moveCount,
        caps: { w: [...captures.w], b: [...captures.b] }, lastMv: { ...lastMove }, posHist: new Map(positionHistory),
        logHTML: elements.moveList.innerHTML, wTime: whiteTime, bTime: blackTime, hasStart: hasGameStarted
    });
    elements.undo.disabled = ++currentHistoryIndex <= 0;
    elements.redo.disabled = currentHistoryIndex >= stateHistory.length - 1;
}

function loadState(i) {
    const s = stateHistory[i];
    if (!s) return;
    boardState.clear();
    s.board.forEach((v, k) => boardState.set(k, { ...v }));
    currentTurn = s.turn; enPassantTarget = s.epTarget; halfMoveClock = s.halfClock; moveCount = s.moveCnt;
    captures = { w: [...s.caps.w], b: [...s.caps.b] }; lastMove = { ...s.lastMv }; positionHistory = new Map(s.posHist);
    whiteTime = s.wTime; blackTime = s.bTime; hasGameStarted = s.hasStart;
    
    document.getElementById('white-captures').innerText = captures.w.join('');
    document.getElementById('black-captures').innerText = captures.b.join('');
    elements.moveList.innerHTML = s.logHTML;
    
    selectedHex = null; validMoves = [];
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    updateClockUI(); updateStatus('State loaded'); drawBoard();
    
    elements.undo.disabled = currentHistoryIndex <= 0;
    elements.redo.disabled = currentHistoryIndex >= stateHistory.length - 1;
}

function initializeBoard() {
    boardState.clear(); positionHistory.clear();
    const setup = [
        { c: 'w', p: ['f1', 'f2', 'f3'], t: 'B', char: '♗' }, { c: 'w', p: ['e1'], t: 'Q', char: '♕' }, { c: 'w', p: ['g1'], t: 'K', char: '♔' },
        { c: 'w', p: ['d1', 'h1'], t: 'N', char: '♘' }, { c: 'w', p: ['c1', 'i1'], t: 'R', char: '♖' },
        { c: 'w', p: ['b1', 'c2', 'd3', 'e4', 'f5', 'g4', 'h3', 'i2', 'k1'], t: 'P', char: '♙' },
        { c: 'b', p: ['f11', 'f10', 'f9'], t: 'B', char: '♝' }, { c: 'b', p: ['e10'], t: 'Q', char: '♛' }, { c: 'b', p: ['g10'], t: 'K', char: '♚' },
        { c: 'b', p: ['h9', 'd9'], t: 'N', char: '♞' }, { c: 'b', p: ['i8', 'c8'], t: 'R', char: '♜' },
        { c: 'b', p: ['b7', 'c7', 'd7', 'e7', 'f7', 'g7', 'h7', 'i7', 'k7'], t: 'P', char: '♟' }
    ];
    setup.forEach(g => g.p.forEach(pos => boardState.set(pos, { char: g.char, type: g.t, color: g.c })));
    positionHistory.set(getPositionHash(), 1);
    updateStatus('Game started'); saveState();
}

function notationToAxial(n) {
    const q = FILES.indexOf(n.charAt(0)) - 5, r = parseInt(n.substring(1)) - 6 - Math.min(0, q);
    return (q < -5 || q > 5 || Math.abs(r) > 5 || Math.abs(q + r) > 5) ? null : { q, r };
}

function axialToNotation(q, r) {
    return (Math.abs(q) > 5 || Math.abs(r) > 5 || Math.abs(q + r) > 5) ? null : `${FILES[q + 5]}${r + 6 + Math.min(0, q)}`;
}

// Universal movement generator
function getDirectionalMoves(q, r, color, vectors, maxSteps) {
    const moves = [];
    vectors.forEach(d => {
        let currQ = q, currR = r, steps = 0;
        while (steps++ < maxSteps) {
            currQ += d[0]; currR += d[1];
            if (Math.abs(currQ) > 5 || Math.abs(currR) > 5 || Math.abs(currQ + currR) > 5) break;
            const target = axialToNotation(currQ, currR);
            if (!boardState.has(target)) moves.push(target);
            else { if (boardState.get(target).color !== color) moves.push(target); break; }
        }
    });
    return moves;
}

function getPawnMoves(q, r, color, notation) {
    const moves = [], fwd = color === 'w' ? [0, 1] : [0, -1], caps = color === 'w' ? [[-1, 1], [1, 0]] : [[1, -1], [-1, 0]];
    const starts = color === 'w' ? ['b1','c2','d3','e4','f5','g4','h3','i2','k1'] : ['b7','c7','d7','e7','f7','g7','h7','i7','k7'];
    
    let f1Note = axialToNotation(q + fwd[0], r + fwd[1]);
    if (f1Note && !boardState.has(f1Note)) {
        moves.push(f1Note);
        if (starts.includes(notation)) {
            let f2Note = axialToNotation(q + fwd[0] * 2, r + fwd[1] * 2);
            if (f2Note && !boardState.has(f2Note)) moves.push(f2Note);
        }
    }
    caps.forEach(c => {
        let capNote = axialToNotation(q + c[0], r + c[1]);
        if (capNote && ((boardState.has(capNote) && boardState.get(capNote).color !== color) || capNote === enPassantTarget)) {
            moves.push(capNote);
        }
    });
    return moves;
}

function getPseudoLegalMoves(piece, notation) {
    const c = notationToAxial(notation);
    switch (piece.type) {
        case 'R': return getDirectionalMoves(c.q, c.r, piece.color, DIRS.rook, 10);
        case 'B': return getDirectionalMoves(c.q, c.r, piece.color, DIRS.bishop, 10);
        case 'Q': return getDirectionalMoves(c.q, c.r, piece.color, [...DIRS.rook, ...DIRS.bishop], 10);
        case 'K': return getDirectionalMoves(c.q, c.r, piece.color, [...DIRS.rook, ...DIRS.bishop], 1);
        case 'N': return getDirectionalMoves(c.q, c.r, piece.color, DIRS.knight, 1);
        case 'P': return getPawnMoves(c.q, c.r, piece.color, notation);
        default: return [];
    }
}

function isKingInCheck(color) {
    const kingEntry = [...boardState.entries()].find(([, p]) => p.type === 'K' && p.color === color);
    return kingEntry && [...boardState.entries()].some(([note, p]) => p.color !== color && getPseudoLegalMoves(p, note).includes(kingEntry[0]));
}

function filterLegalMoves(startHex, pseudoMoves, piece) {
    return pseudoMoves.filter(targetHex => {
        const capturedPiece = boardState.get(targetHex);
        let epHex = null, epPiece = null;

        if (piece.type === 'P' && targetHex === enPassantTarget) {
            epHex = axialToNotation(notationToAxial(targetHex).q, piece.color === 'w' ? notationToAxial(targetHex).r - 1 : notationToAxial(targetHex).r + 1);
            epPiece = boardState.get(epHex);
            boardState.delete(epHex);
        }

        boardState.set(targetHex, piece); boardState.delete(startHex);
        const isValid = !isKingInCheck(piece.color);
        
        boardState.set(startHex, piece);
        if (capturedPiece) boardState.set(targetHex, capturedPiece); else boardState.delete(targetHex);
        if (epHex) boardState.set(epHex, epPiece);
        return isValid;
    });
}

function getPositionHash() {
    return `Turn:${currentTurn}|EP:${enPassantTarget || '-'}|Pieces:` + [...boardState.entries()].sort().map(([k, p]) => `${k}${p.color}${p.type}`).join(',');
}

function hasAnyLegalMoves(color) {
    return [...boardState.entries()].some(([note, piece]) => piece.color === color && filterLegalMoves(note, getPseudoLegalMoves(piece, note), piece).length > 0);
}

function isInsufficientMaterial() {
    const pcs = [...boardState.values()];
    if (pcs.some(p => ['P', 'R', 'Q'].includes(p.type))) return false;
    const w = pcs.filter(p => p.color === 'w').length, b = pcs.filter(p => p.color === 'b').length;
    return (w === 1 && b === 1) || (w === 2 && b === 1) || (w === 1 && b === 2);
}

function drawHex(x, y, size, colIdx, sel, val, last, chk, hov, isAttack) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) ctx.lineTo(x + size * Math.cos(i * Math.PI / 3), y + size * Math.sin(i * Math.PI / 3));
    ctx.closePath();
    
    // Updated fill colors to include a subtle red tint for captures
    if (chk) ctx.fillStyle = 'rgba(255, 50, 50, 0.8)';
    else if (sel) ctx.fillStyle = 'rgba(255, 255, 0, 0.5)';
    else if (isAttack) ctx.fillStyle = 'rgba(255, 80, 80, 0.5)'; 
    else if (val) ctx.fillStyle = 'rgba(0, 150, 255, 0.4)';
    else if (last) ctx.fillStyle = 'rgba(85, 191, 218, 0.6)';
    else ctx.fillStyle = colors[colIdx];
    ctx.fill();

    // Updated stroke colors to include a red border for captures
    ctx.strokeStyle = hov ? 'rgba(255, 255, 255, 0.9)' : (isAttack ? '#ff3333' : '#000');
    ctx.lineWidth = (hov || isAttack) ? 3.5 : 1.5; 
    ctx.lineJoin = 'round';
    ctx.stroke();
}

function getHexPixels(q, r) {
    const rq = isFlipped ? -q : q, rr = isFlipped ? -r : r, dpr = window.devicePixelRatio || 1;
    return { px: (canvas.width / dpr) / 2 + hexSize * 1.5 * rq, py: (canvas.height / dpr) / 2 - hexSize * Math.sqrt(3) * (rr + rq / 2) };
}

function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const wCheck = isKingInCheck('w'), bCheck = isKingInCheck('b');

    for (let q = -5; q <= 5; q++) {
        for (let r = -5; r <= 5; r++) {
            if (Math.abs(q + r) > 5) continue;
            const n = axialToNotation(q, r), { px, py } = getHexPixels(q, r), piece = boardState.get(n);
            const isChk = piece && piece.type === 'K' && ((piece.color === 'w' && wCheck) || (piece.color === 'b' && bCheck));
            
            // Check if a valid move is targeting an enemy or an En Passant square
            const isValid = validMoves.includes(n);
            let isAttack = false;
            if (isValid) {
                if (boardState.has(n) && boardState.get(n).color !== currentTurn) isAttack = true;
                if (n === enPassantTarget && selectedHex && boardState.has(selectedHex) && boardState.get(selectedHex).type === 'P') isAttack = true;
            }

            drawHex(px, py, hexSize, ((q - r) % 3 + 3) % 3, n === selectedHex, isValid, (n === lastMove.from || n === lastMove.to), isChk, n === hoveredHex, isAttack);
            
            if (piece) {
                ctx.fillStyle = piece.color === 'w' ? '#fff' : '#000'; ctx.strokeStyle = piece.color === 'w' ? '#000' : '#fff';
                ctx.lineWidth = 1; ctx.font = `${hexSize * 1.4}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.strokeText(piece.char, px, py); ctx.fillText(piece.char, px, py);
            }
        }
    }
    ctx.fillStyle = "#fff"; ctx.font = `bold ${hexSize * 0.75}px Arial`;
    BOARD_LABELS.forEach(l => {
        const c = notationToAxial(l.hex);
        if (c) ctx.fillText(l.text, getHexPixels(c.q, c.r).px + (isFlipped ? -l.xOff : l.xOff) * hexSize, getHexPixels(c.q, c.r).py + (isFlipped ? -l.yOff : l.yOff) * hexSize);
    });
}

function commitMove(from, to) {
    const piece = boardState.get(from), endC = notationToAxial(to);
    if (!piece) return false;
    let nextEp = null, isCap = boardState.has(to);

    if (isCap) {
        captures[piece.color].push(boardState.get(to).char);
        document.getElementById(`${piece.color === 'w' ? 'white' : 'black'}-captures`).innerText = captures[piece.color].join('');
    }

    if (piece.type === 'P') {
        const startC = notationToAxial(from);
        if (to === enPassantTarget) {
            const epHex = axialToNotation(endC.q, piece.color === 'w' ? endC.r - 1 : endC.r + 1);
            captures[piece.color].push(boardState.get(epHex).char);
            document.getElementById(`${piece.color === 'w' ? 'white' : 'black'}-captures`).innerText = captures[piece.color].join('');
            boardState.delete(epHex); isCap = true;
        }
        if (Math.abs(endC.r - startC.r) === 2) nextEp = axialToNotation(startC.q, piece.color === 'w' ? startC.r + 1 : startC.r - 1);
    }

    halfMoveClock = (piece.type === 'P' || isCap) ? 0 : halfMoveClock + 1;
    playSound(isCap ? 'capture' : 'move');

    boardState.set(to, piece); boardState.delete(from);
    enPassantTarget = nextEp; lastMove = { from, to };

    if (piece.type === 'P' && !axialToNotation(endC.q, piece.color === 'w' ? endC.r + 1 : endC.r - 1)) {
        pendingPromotion = { notation: to, color: piece.color, originalNotation: `${piece.type}${from}-${to}` };
        document.getElementById('promotion-modal').classList.remove('hidden');
        selectedHex = null; validMoves = []; drawBoard(); return true;
    }

    finalizeTurn(`${piece.type}${from}-${to}`, piece.color);
    return true;
}

function executePromotion(notation, type, color, originalNotation) {
    const chars = { 'w': { 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘' }, 'b': { 'Q': '♛', 'R': '♜', 'B': '♝', 'N': '♞' } };
    boardState.set(notation, { char: chars[color][type], type: type, color: color });
    document.getElementById('promotion-modal').classList.add('hidden');
    pendingPromotion = null;
    finalizeTurn(`${originalNotation}=${type}`, color);
}

document.querySelectorAll('#promotion-options button').forEach(btn => btn.addEventListener('click', (e) => {
    executePromotion(pendingPromotion.notation, e.target.getAttribute('data-piece'), pendingPromotion.color, pendingPromotion.originalNotation);
}));

function finalizeTurn(moveInfo, color) {
    if (color === 'w') {
        elements.moveList.insertAdjacentHTML('beforeend', `<div class="move-entry" id="m-${moveCount}"><span class="move-number">${moveCount}.</span> <span class="white-move">${moveInfo}</span></div>`);
    } else {
        const row = document.getElementById(`m-${moveCount}`);
        if (row) row.insertAdjacentHTML('beforeend', ` &nbsp;&nbsp; <span class="black-move">${moveInfo}</span>`);
        moveCount++;
    }
    elements.moveList.scrollTop = elements.moveList.scrollHeight;
    
    currentTurn = currentTurn === 'w' ? 'b' : 'w';
    if (!hasGameStarted) { hasGameStarted = true; startTimer(); }
    if (!isUnlimited && hasGameStarted) { color === 'w' ? whiteTime += increment : blackTime += increment; updateClockUI(); }
    
    selectedHex = null; validMoves = [];
    const hash = getPositionHash(); positionHistory.set(hash, (positionHistory.get(hash) || 0) + 1);

    if (isKingInCheck(currentTurn) && !hasAnyLegalMoves(currentTurn)) triggerGameOver("Checkmate!", `${color === 'w' ? 'White' : 'Black'} wins.`);
    else if (!hasAnyLegalMoves(currentTurn)) triggerGameOver("Stalemate", "Draw.");
    else if (positionHistory.get(hash) >= 3) triggerGameOver("Draw", "Threefold Repetition.");
    else if (halfMoveClock >= 100) triggerGameOver("Draw", "50-Move Rule.");
    else if (isInsufficientMaterial()) triggerGameOver("Draw", "Insufficient Material.");
    else {
        updateStatus(isKingInCheck(currentTurn) ? `Check! ${moveInfo}` : `Moved ${moveInfo}`);
        if (gameMode !== 'hotseat' && currentTurn === aiSide) setTimeout(requestAiMove, 250);
    }
    saveState(); drawBoard();
}

function getNotationFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches && e.touches.length > 0 ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches && e.touches.length > 0 ? e.touches[0].clientY : e.clientY;
    
    const px = (clientX - rect.left) - rect.width / 2, py = (clientY - rect.top) - rect.height / 2;
    const qF = (2/3 * px) / hexSize, rF = (-1/3 * px - Math.sqrt(3)/3 * py) / hexSize, sF = -qF - rF;
    
    let q = Math.round(qF), r = Math.round(rF), s = Math.round(sF);
    if (Math.abs(q - qF) > Math.abs(r - rF) && Math.abs(q - qF) > Math.abs(s - sF)) q = -r - s; else if (Math.abs(r - rF) > Math.abs(s - sF)) r = -q - s;
    
    return axialToNotation(isFlipped ? -q : q, isFlipped ? -r : r);
}

function handleBoardInteraction(e) {
    if (e.type === 'touchstart') e.preventDefault(); // Prevents mobile screen from scrolling when interacting with the board
    if (pendingPromotion || !document.getElementById('game-over-modal').classList.contains('hidden')) return;
    
    const n = getNotationFromEvent(e);
    if (!n) return;
    
    if (selectedHex) { 
        if (selectedHex === n) { selectedHex = null; validMoves = []; drawBoard(); } 
        else if (validMoves.includes(n)) commitMove(selectedHex, n); 
    } else if (boardState.has(n) && boardState.get(n).color === currentTurn) {
        selectedHex = n; validMoves = filterLegalMoves(n, getPseudoLegalMoves(boardState.get(n), n), boardState.get(n)); drawBoard();
    }
}

canvas.addEventListener('mousedown', handleBoardInteraction);
canvas.addEventListener('touchstart', handleBoardInteraction, {passive: false});

canvas.addEventListener('mousemove', (e) => {
    const n = getNotationFromEvent(e);
    if (n !== hoveredHex) { hoveredHex = n; elements.hover.innerText = n ? `Hex: ${n}` : `Hex: --`; drawBoard(); }
});
canvas.addEventListener('mouseleave', () => { hoveredHex = null; elements.hover.innerText = `Hex: --`; drawBoard(); });

function formatTime(s) { return isUnlimited ? "∞" : `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`; }
function updateClockUI() {
    document.getElementById('white-timer').innerText = formatTime(whiteTime);
    document.getElementById('black-timer').innerText = formatTime(blackTime);
    document.getElementById('white-timer').classList.toggle('active', !isUnlimited && isTimerRunning && currentTurn === 'w');
    document.getElementById('black-timer').classList.toggle('active', !isUnlimited && isTimerRunning && currentTurn === 'b');
}
function tickTimer() {
    if (!isTimerRunning || isUnlimited) return;
    currentTurn === 'w' ? whiteTime-- : blackTime--; updateClockUI();
    if (whiteTime <= 0 || blackTime <= 0) triggerGameOver("Timeout", `${whiteTime <= 0 ? 'Black' : 'White'} wins on time.`);
}
function startTimer() { if (timerInterval) clearInterval(timerInterval); isTimerRunning = true; timerInterval = setInterval(tickTimer, 1000); updateClockUI(); }
function stopTimer() { isTimerRunning = false; if (timerInterval) clearInterval(timerInterval); updateClockUI(); }
function parseTimeControl() {
    const tc = elements.timeControl.value;
    if (tc === 'unlimited') { isUnlimited = true; whiteTime = blackTime = increment = 0; } 
    else { isUnlimited = false; const [m, i] = tc.split('+').map(Number); whiteTime = blackTime = m * 60; increment = i; }
    updateClockUI();
}

elements.timeControl.addEventListener('change', () => confirm("Changing time controls restarts the game. Proceed?") ? resetGame() : elements.timeControl.value = isUnlimited ? 'unlimited' : `${whiteTime/60}+${increment}`);

function triggerGameOver(t, m) { stopTimer(); playSound('end'); document.getElementById('game-over-title').innerText = t; document.getElementById('game-over-message').innerText = m; document.getElementById('game-over-modal').classList.remove('hidden'); updateStatus(`Game Over: ${t}`); }
function resetGame() { stopTimer(); boardState.clear(); positionHistory.clear(); stateHistory = []; currentHistoryIndex = -1; captures = { w: [], b: [] }; lastMove = { from: null, to: null }; moveCount = 1; halfMoveClock = 0; currentTurn = 'w'; hasGameStarted = false; document.getElementById('game-over-modal').classList.add('hidden'); document.getElementById('white-captures').innerText = ''; document.getElementById('black-captures').innerText = ''; elements.moveList.innerHTML = ''; parseTimeControl(); initializeBoard(); drawBoard(); }
document.getElementById('restart-btn').addEventListener('click', resetGame);

elements.fen.addEventListener('click', () => {
    let f = [];
    for (let r = 11; r >= 1; r--) {
        let str = "", eC = 0;
        for (let i = 0; i < FILES.length; i++) {
            const n = `${FILES[i]}${r}`;
            if (boardState.has(n)) { if (eC > 0) { str += eC; eC = 0; } str += boardState.get(n).color === 'w' ? boardState.get(n).type.toUpperCase() : boardState.get(n).type.toLowerCase(); } else eC++;
        }
        f.push(eC > 0 ? str + eC : str);
    }
    const fen = `${f.join('/')} ${currentTurn} - ${enPassantTarget || '-'} ${halfMoveClock} ${moveCount}`;
    (navigator.clipboard && window.isSecureContext) ? navigator.clipboard.writeText(fen).then(() => updateStatus("FEN copied!")).catch(() => prompt("Copy FEN:", fen)) : prompt("Copy FEN:", fen);
});

const aiWorker = new Worker('ai-worker.js');
aiWorker.onmessage = e => { if (e.data.type === 'bestmove') executeAiMove(e.data.move); };
function requestAiMove() { if (hasGameStarted) { updateStatus("AI calculating..."); aiWorker.postMessage({ type: 'search', pieces: Array.from(boardState.entries()), turn: currentTurn, ep: enPassantTarget, half: halfMoveClock, full: moveCount, depth: 10 }); } }
function executeAiMove(m) {
    if (m === '(none)') return updateStatus("AI has no moves");
    setTimeout(() => {
        commitMove(m.substring(0, 2), m.substring(2, 4));
        if (m.length > 4 && pendingPromotion) {
            executePromotion(pendingPromotion.notation, m[4].toUpperCase(), pendingPromotion.color, pendingPromotion.originalNotation);
        }
    }, 600);
}

function resizeCanvas() {
    const w = document.getElementById('canvas-wrapper'); if (!w) return;
    const s = Math.min(w.offsetWidth, w.offsetHeight), dpr = window.devicePixelRatio || 1;
    if (s <= 0) return;
    canvas.width = canvas.style.width = s * dpr; canvas.height = canvas.style.height = s * dpr;
    canvas.style.width = canvas.style.height = s + "px";
    ctx.resetTransform(); ctx.scale(dpr, dpr);
    hexSize = (s / 11) * 0.85 * (1 / Math.sqrt(3));
    drawBoard();
}

window.addEventListener('resize', resizeCanvas);
initializeBoard(); resizeCanvas();