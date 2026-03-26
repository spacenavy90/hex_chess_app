const canvas = document.getElementById('hex-canvas');
const ctx = canvas.getContext('2d');
const flipBtn = document.getElementById('flip-btn');
const statusDiv = document.getElementById('status');
const turnDisplay = document.getElementById('turn-display');
const hoverCoordDisplay = document.getElementById('hover-coord'); // NEW

// Timer State
let whiteTime = 600; 
let blackTime = 600;
let increment = 0;
let timerInterval = null;
let isTimerRunning = false;
let isUnlimited = false;
let hasGameStarted = false;
let hoveredHex = null;

// Board State
let isFlipped = false;
let hexSize = 25; 
let currentTurn = 'w';
let selectedHex = null; 
let validMoves = []; 
let enPassantTarget = null;
let pendingPromotion = null;
let moveCount = 1;
let halfMoveClock = 0; // Tracks moves since last pawn move or capture
let positionHistory = new Map(); // Tracks board states for threefold repetition
let stateHistory = [];
let currentHistoryIndex = -1;

const moveListElement = document.getElementById('move-list');
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'k', 'l'];
const boardState = new Map();

// Hex Colors (Light, Medium, Dark)
const colors = ['#b58863', '#8b5a2b', '#f0d9b5'];

// Static Label Data
const BOARD_LABELS = [
    // Files (Bottom Slanted Edges)
    { text: 'a', hex: 'a1', xOff: 0, yOff: 1.5 },
    { text: 'b', hex: 'b1', xOff: 0, yOff: 1.5 },
    { text: 'c', hex: 'c1', xOff: 0, yOff: 1.5 },
    { text: 'd', hex: 'd1', xOff: 0, yOff: 1.5 },
    { text: 'e', hex: 'e1', xOff: 0, yOff: 1.5 },
    { text: 'f', hex: 'f1', xOff: 0, yOff: 1.7 },
    { text: 'g', hex: 'g1', xOff: 0, yOff: 1.5 },
    { text: 'h', hex: 'h1', xOff: 0, yOff: 1.5 },
    { text: 'i', hex: 'i1', xOff: 0, yOff: 1.5 },
    { text: 'k', hex: 'k1', xOff: 0, yOff: 1.5 },
    { text: 'l', hex: 'l1', xOff: 0, yOff: 1.5 },
    
    // Ranks Left (Vertical 1-6 then Slanted 7-11)
    { text: '1', hex: 'a1', xOff: -1.2, yOff: -0.6 },
    { text: '2', hex: 'a2', xOff: -1.2, yOff: -0.6 },
    { text: '3', hex: 'a3', xOff: -1.2, yOff: -0.6 },
    { text: '4', hex: 'a4', xOff: -1.2, yOff: -0.6 },
    { text: '5', hex: 'a5', xOff: -1.2, yOff: -0.6 },
    { text: '6', hex: 'a6', xOff: -1.2, yOff: -0.6 },
    { text: '7', hex: 'b7', xOff: -1.2, yOff: -0.6 },
    { text: '8', hex: 'c8', xOff: -1.2, yOff: -0.6 },
    { text: '9', hex: 'd9', xOff: -1.2, yOff: -0.6 },
    { text: '10', hex: 'e10', xOff: -1.2, yOff: -0.6 },
    { text: '11', hex: 'f11', xOff: -1.2, yOff: -0.6 }, // Peak Left
    
    // Ranks Right (Vertical 1-6 then Slanted 7-11)
    { text: '1', hex: 'l1', xOff: 1.2, yOff: -0.6 },
    { text: '2', hex: 'l2', xOff: 1.2, yOff: -0.6 },
    { text: '3', hex: 'l3', xOff: 1.2, yOff: -0.6 },
    { text: '4', hex: 'l4', xOff: 1.2, yOff: -0.6 },
    { text: '5', hex: 'l5', xOff: 1.2, yOff: -0.6 },
    { text: '6', hex: 'l6', xOff: 1.2, yOff: -0.6 },
    { text: '7', hex: 'k7', xOff: 1.2, yOff: -0.6 },
    { text: '8', hex: 'i8', xOff: 1.2, yOff: -0.6 },
    { text: '9', hex: 'h9', xOff: 1.2, yOff: -0.6 },
    { text: '10', hex: 'g10', xOff: 1.2, yOff: -0.6 },
    { text: '11', hex: 'f11', xOff: 1.2, yOff: -0.6 } // Peak Right
];

let lastMove = { from: null, to: null };
let captures = { w: [], b: [] };

let gameMode = 'hotseat';
let aiSide = null; // 'w' or 'b'

// Selection Listener
document.getElementById('mode-select').addEventListener('change', (e) => {
    gameMode = e.target.value;
    
    if (gameMode === 'ai-black') {
        aiSide = 'b';
        if (currentTurn === 'b') requestAiMove();
    } else if (gameMode === 'ai-white') {
        aiSide = 'w';
        if (currentTurn === 'w') requestAiMove();
    } else {
        aiSide = null;
    }
    
    updateStatus(`Mode: ${gameMode.replace('-', ' ')}`);
});

// Synthesizer for self-contained sound effects
let audioCtx = null; // Declare it empty first
function playSound(type) {
    // Create it ONLY upon the first time a sound is requested (after a user click)
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    if (type === 'move') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start(); osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'capture') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.15);
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        osc.start(); osc.stop(audioCtx.currentTime + 0.15);
    } else if (type === 'end') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(200, audioCtx.currentTime + 0.5);
        gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        osc.start(); osc.stop(audioCtx.currentTime + 0.5);
    }
}

// --- STATE MANAGEMENT (Undo/Redo) ---
function updateUndoRedoButtons() {
    document.getElementById('undo-btn').disabled = currentHistoryIndex <= 0;
    document.getElementById('redo-btn').disabled = currentHistoryIndex >= stateHistory.length - 1;
}

function saveState() {
    // If we undo and then make a new move, erase the "future" redo history
    if (currentHistoryIndex < stateHistory.length - 1) {
        stateHistory = stateHistory.slice(0, currentHistoryIndex + 1);
    }
    
    // Deep clone the board Map
    const clonedBoard = new Map();
    for (let [pos, piece] of boardState.entries()) {
        clonedBoard.set(pos, { ...piece });
    }

    // Create a complete snapshot of current logic and UI state
    const stateSnapshot = {
        board: clonedBoard,
        turn: currentTurn,
        epTarget: enPassantTarget,
        halfClock: halfMoveClock,
        moveCnt: moveCount,
        caps: { w: [...captures.w], b: [...captures.b] },
        lastMv: { ...lastMove },
        posHist: new Map(positionHistory),
        logHTML: moveListElement.innerHTML, // Snapshot the move history DOM
        wTime: whiteTime,
        bTime: blackTime,
        hasStart: hasGameStarted
    };

    stateHistory.push(stateSnapshot);
    currentHistoryIndex++;
    updateUndoRedoButtons();
}

function loadState(index) {
    const state = stateHistory[index];
    if (!state) return;

    // 1. Restore core logic state
    boardState.clear();
    for (let [pos, piece] of state.board.entries()) {
        boardState.set(pos, { ...piece });
    }
    
    currentTurn = state.turn;
    enPassantTarget = state.epTarget;
    halfMoveClock = state.halfClock;
    moveCount = state.moveCnt;
    captures = { w: [...state.caps.w], b: [...state.caps.b] };
    lastMove = { ...state.lastMv };
    positionHistory = new Map(state.posHist);
    
    // 2. Restore Timer state
    whiteTime = state.wTime;
    blackTime = state.bTime;
    hasGameStarted = state.hasStart; // FIXED: variable name
    
    // 3. Sync UI elements
    document.getElementById('white-captures').innerText = captures.w.join('');
    document.getElementById('black-captures').innerText = captures.b.join('');
    moveListElement.innerHTML = state.logHTML;
    document.getElementById('turn-display').innerText = `${currentTurn === 'w' ? 'White' : 'Black'} to move`;
    updateClockUI();
    
    // 4. Cleanup UI interactions
    selectedHex = null;
    validMoves = [];
    document.getElementById('game-over-modal').classList.add('hidden');
    document.getElementById('promotion-modal').classList.add('hidden');
    
    drawBoard();
}

// --- ACTION BUTTON LISTENERS ---
document.getElementById('undo-btn').addEventListener('click', () => {
    if (currentHistoryIndex > 0) {
        currentHistoryIndex--;
        loadState(currentHistoryIndex);
        updateUndoRedoButtons();
    }
});

document.getElementById('redo-btn').addEventListener('click', () => {
    if (currentHistoryIndex < stateHistory.length - 1) {
        currentHistoryIndex++;
        loadState(currentHistoryIndex);
        updateUndoRedoButtons();
    }
});

// Draw & Resign Logic (Hotseat Prompts)
document.getElementById('w-resign-btn').addEventListener('click', () => triggerGameOver("White Resigns", "Black wins."));
document.getElementById('b-resign-btn').addEventListener('click', () => triggerGameOver("Black Resigns", "White wins."));

document.getElementById('w-draw-btn').addEventListener('click', () => {
    if (confirm("White offers a draw. Does Black accept?")) triggerGameOver("Draw", "By mutual agreement.");
});
document.getElementById('b-draw-btn').addEventListener('click', () => {
    if (confirm("Black offers a draw. Does White accept?")) triggerGameOver("Draw", "By mutual agreement.");
});

// Initialize true Glinski starting positions
function initializeBoard() {
    boardState.clear();
    positionHistory.clear();
    
    // White Pieces
    boardState.set('f1', { char: '♗', type: 'B', color: 'w' });
    boardState.set('f2', { char: '♗', type: 'B', color: 'w' });
    boardState.set('f3', { char: '♗', type: 'B', color: 'w' });
    boardState.set('e1', { char: '♕', type: 'Q', color: 'w' });
    boardState.set('g1', { char: '♔', type: 'K', color: 'w' });
    boardState.set('d1', { char: '♘', type: 'N', color: 'w' });
    boardState.set('h1', { char: '♘', type: 'N', color: 'w' });
    boardState.set('c1', { char: '♖', type: 'R', color: 'w' });
    boardState.set('i1', { char: '♖', type: 'R', color: 'w' });
    
    // White Pawns (V-shape: 9 pawns)
    const whitePawns = ['b1', 'c2', 'd3', 'e4', 'f5', 'g4', 'h3', 'i2', 'k1'];
    whitePawns.forEach(pos => boardState.set(pos, { char: '♙', type: 'P', color: 'w' }));

    // Black Pieces
    boardState.set('f11', { char: '♝', type: 'B', color: 'b' });
    boardState.set('f10', { char: '♝', type: 'B', color: 'b' });
    boardState.set('f9',  { char: '♝', type: 'B', color: 'b' });
    boardState.set('e10', { char: '♛', type: 'Q', color: 'b' }); 
    boardState.set('g10', { char: '♚', type: 'K', color: 'b' }); 
    boardState.set('h9', { char: '♞', type: 'N', color: 'b' });
    boardState.set('d9', { char: '♞', type: 'N', color: 'b' });
    boardState.set('i8', { char: '♜', type: 'R', color: 'b' });
    boardState.set('c8', { char: '♜', type: 'R', color: 'b' });

    // Black Pawns (Inverted V-shape: 9 pawns)
    const blackPawns = ['b7', 'c7', 'd7', 'e7', 'f7', 'g7', 'h7', 'i7', 'k7'];
    blackPawns.forEach(pos => boardState.set(pos, { char: '♟', type: 'P', color: 'b' }));
    
    const startHash = getPositionHash();
    positionHistory.set(startHash, 1);
    
    updateStatus('Game started');
    saveState();
}

// Coordinate Translation: Notation to Axial (q, r)
function notationToAxial(notation) {
    const fileChar = notation.charAt(0);
    const rank = parseInt(notation.substring(1));
    
    const q = FILES.indexOf(fileChar) - 5;
    if (q < -5 || q > 5) return null;

    const r = rank - 6 - Math.min(0, q);
    
    if (Math.abs(q) > 5 || Math.abs(r) > 5 || Math.abs(q + r) > 5) return null;

    return { q, r };
}

// Coordinate Translation: Axial (q, r) to Notation
function axialToNotation(q, r) {
    if (Math.abs(q) > 5 || Math.abs(r) > 5 || Math.abs(q + r) > 5) return null;
    const fileChar = FILES[q + 5];
    const rank = r + 6 + Math.min(0, q);
    return `${fileChar}${rank}`;
}

// Calculates sliding paths for the Rook
function getRookMoves(q, r, color) {
    const moves = [];
    // The 6 orthogonal directions (straight through the edges of adjacent hexes)
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];

    dirs.forEach(d => {
        let currQ = q + d[0];
        let currR = r + d[1];

        // Slide until we hit the edge of the 91-hex board
        while (Math.abs(currQ) <= 5 && Math.abs(currR) <= 5 && Math.abs(currQ + currR) <= 5) {
            const targetNote = axialToNotation(currQ, currR);

            if (!boardState.has(targetNote)) {
                moves.push(targetNote); // Empty space, keep sliding
            } else {
                // Hit a piece. If it's an enemy, it's a valid capture.
                if (boardState.get(targetNote).color !== color) {
                    moves.push(targetNote);
                }
                break; // Stop sliding past any piece
            }
            currQ += d[0];
            currR += d[1];
        }
    });
    return moves;
}

// Bishop valid moves: Calculates sliding paths
function getBishopMoves(q, r, color) {
    const moves = [];
    // The 6 true mathematical vectors that stay on the same color in a flat-topped grid
    const dirs = [[2, -1], [1, 1], [-1, 2], [-2, 1], [-1, -1], [1, -2]];

    dirs.forEach(d => {
        let currQ = q + d[0];
        let currR = r + d[1];

        // Slide until we hit the board edge
        while (Math.abs(currQ) <= 5 && Math.abs(currR) <= 5 && Math.abs(currQ + currR) <= 5) {
            const targetNote = axialToNotation(currQ, currR);

            if (!boardState.has(targetNote)) {
                moves.push(targetNote); // Empty space, keep sliding
            } else {
                // Hit a piece. If it's an enemy, it's a valid capture. Stop sliding.
                if (boardState.get(targetNote).color !== color) {
                    moves.push(targetNote);
                }
                break;
            }
            currQ += d[0];
            currR += d[1];
        }
    });
    return moves;
}

// Calculates sliding paths for the Queen (combines Bishop and Rook)
function getQueenMoves(q, r, color) {
    const bishopMoves = getBishopMoves(q, r, color);
    const rookMoves = getRookMoves(q, r, color);
    return [...bishopMoves, ...rookMoves]; // Merges both arrays
}

// Calculates single-step moves for the King in all 12 directions
function getKingMoves(q, r, color) {
    const moves = [];
    const dirs = [
        // 6 Orthogonal directions
        [1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1],
        // 6 Diagonal directions
        [2, -1], [1, 1], [-1, 2], [-2, 1], [-1, -1], [1, -2]
    ];

    dirs.forEach(d => {
        let targetQ = q + d[0];
        let targetR = r + d[1];

        // Check if the target hex is within the 91-hex board boundary
        if (Math.abs(targetQ) <= 5 && Math.abs(targetR) <= 5 && Math.abs(targetQ + targetR) <= 5) {
            const targetNote = axialToNotation(targetQ, targetR);
            
            if (!boardState.has(targetNote)) {
                moves.push(targetNote); // Empty space
            } else {
                // Check if the occupied hex has an enemy piece
                if (boardState.get(targetNote).color !== color) {
                    moves.push(targetNote);
                }
            }
        }
    });
    return moves;
}

// Calculates jumping moves for the Knight in all 12 directions
function getKnightMoves(q, r, color) {
    const moves = [];
    // The 12 distinct L-shape jumps in an axial hex grid
    const dirs = [
        [1, -3], [2, -3], [3, -2], [3, -1],
        [2, 1], [1, 2], [-1, 3], [-2, 3],
        [-3, 2], [-3, 1], [-2, -1], [-1, -2]
    ];

    dirs.forEach(d => {
        let targetQ = q + d[0];
        let targetR = r + d[1];

        // Check if the target hex is within the board boundary
        if (Math.abs(targetQ) <= 5 && Math.abs(targetR) <= 5 && Math.abs(targetQ + targetR) <= 5) {
            const targetNote = axialToNotation(targetQ, targetR);
            
            if (!boardState.has(targetNote)) {
                moves.push(targetNote); // Empty space
            } else {
                // Check if the occupied hex has an enemy piece
                if (boardState.get(targetNote).color !== color) {
                    moves.push(targetNote);
                }
            }
        }
    });
    return moves;
}

// Calculates Pawn moves (forward, double-start, and diagonal captures)
function getPawnMoves(q, r, color, notation) {
    const moves = [];
    const forward = color === 'w' ? [0, 1] : [0, -1];
    const captures = color === 'w' ? [[-1, 1], [1, 0]] : [[1, -1], [-1, 0]];
    
    // Check against your specific starting positions for double-moves
    const startPawnsW = ['b1', 'c2', 'd3', 'e4', 'f5', 'g4', 'h3', 'i2', 'k1'];
    const startPawnsB = ['b7', 'c7', 'd7', 'e7', 'f7', 'g7', 'h7', 'i7', 'k7'];
    const isStart = color === 'w' ? startPawnsW.includes(notation) : startPawnsB.includes(notation);

    // Forward 1 step
    let f1Q = q + forward[0];
    let f1R = r + forward[1];
    let f1Note = axialToNotation(f1Q, f1R);

    if (f1Note && !boardState.has(f1Note)) {
        moves.push(f1Note);

        // Forward 2 steps (only allowed if Forward 1 is also clear)
        if (isStart) {
            let f2Q = q + forward[0] * 2;
            let f2R = r + forward[1] * 2;
            let f2Note = axialToNotation(f2Q, f2R);
            if (f2Note && !boardState.has(f2Note)) {
                moves.push(f2Note);
            }
        }
    }

    // Captures (Diagonal Forward)
    captures.forEach(c => {
        let capQ = q + c[0];
        let capR = r + c[1];
        let capNote = axialToNotation(capQ, capR);

        if (capNote) {
            if (boardState.has(capNote) && boardState.get(capNote).color !== color) {
                moves.push(capNote); // Standard enemy capture
            } else if (capNote === enPassantTarget) {
                moves.push(capNote); // Valid En Passant hex
            }
        }
    });

    return moves;
}

// Helper to get raw moves without checking King safety
function getPseudoLegalMoves(piece, notation) {
    const coords = notationToAxial(notation);
    if (piece.type === 'B') return getBishopMoves(coords.q, coords.r, piece.color);
    if (piece.type === 'R') return getRookMoves(coords.q, coords.r, piece.color);
    if (piece.type === 'Q') return getQueenMoves(coords.q, coords.r, piece.color);
    if (piece.type === 'K') return getKingMoves(coords.q, coords.r, piece.color);
    if (piece.type === 'N') return getKnightMoves(coords.q, coords.r, piece.color);
    if (piece.type === 'P') return getPawnMoves(coords.q, coords.r, piece.color, notation);
    return [];
}

// Scans the board to see if the specified color's King is under attack
function isKingInCheck(color) {
    let kingHex = null;
    for (let [note, piece] of boardState.entries()) {
        if (piece.type === 'K' && piece.color === color) {
            kingHex = note; 
            break;
        }
    }
    if (!kingHex) return false; 

    for (let [note, piece] of boardState.entries()) {
        if (piece.color !== color) {
            const moves = getPseudoLegalMoves(piece, note);
            if (moves.includes(kingHex)) return true;
        }
    }
    return false;
}

// Simulates each move to ensure it doesn't result in self-check
function filterLegalMoves(startHex, pseudoMoves, piece) {
    const legalMoves = [];
    
    for (let targetHex of pseudoMoves) {
        const capturedPiece = boardState.get(targetHex);
        let epCapturedHex = null;
        let epCapturedPiece = null;

        // Handle En Passant simulation
        if (piece.type === 'P' && targetHex === enPassantTarget) {
            const endCoords = notationToAxial(targetHex);
            const captureR = piece.color === 'w' ? endCoords.r - 1 : endCoords.r + 1;
            epCapturedHex = axialToNotation(endCoords.q, captureR);
            epCapturedPiece = boardState.get(epCapturedHex);
            boardState.delete(epCapturedHex);
        }

        // Apply temporary move
        boardState.set(targetHex, piece);
        boardState.delete(startHex);

        // Validate
        if (!isKingInCheck(piece.color)) {
            legalMoves.push(targetHex);
        }

        // Revert move
        boardState.set(startHex, piece);
        if (capturedPiece) {
            boardState.set(targetHex, capturedPiece);
        } else {
            boardState.delete(targetHex);
        }
        if (epCapturedHex) {
            boardState.set(epCapturedHex, epCapturedPiece);
        }
    }
    return legalMoves;
}

// Generates a unique string for the current board state
function getPositionHash() {
    // FIDE Rules: Pieces + Current Player + En Passant rights
    let hash = `Turn:${currentTurn}|EP:${enPassantTarget || '-'}|Pieces:`;
    
    // Sort keys so the string is identical regardless of Map insertion order
    const sortedKeys = Array.from(boardState.keys()).sort();
    for (let key of sortedKeys) {
        const p = boardState.get(key);
        hash += `${key}${p.color}${p.type},`;
    }
    return hash;
}

// Checks if the remaining pieces are incapable of delivering checkmate
function isInsufficientMaterial() {
    // If there are pawns, rooks, or queens, mate is possible
    for (let p of boardState.values()) {
        if (['P', 'R', 'Q'].includes(p.type)) return false;
    }

    let whiteCount = 0;
    let blackCount = 0;

    for (let p of boardState.values()) {
        if (p.color === 'w') whiteCount++;
        else blackCount++;
    }

    // King vs King
    if (whiteCount === 1 && blackCount === 1) return true;
    
    // King + Minor Piece vs King
    if ((whiteCount === 2 && blackCount === 1) || (whiteCount === 1 && blackCount === 2)) return true;

    return false;
}

// Checks if the specified color has any legal moves left
function isCheckmate(color) {
    if (!isKingInCheck(color)) return false; // Could be stalemate, but not checkmate

    // Array.from() creates a static snapshot so we don't infinitely loop when filterLegalMoves modifies the Map
    const pieces = Array.from(boardState.entries()); 
    for (let [note, piece] of pieces) {
        if (piece.color === color) {
            const pseudo = getPseudoLegalMoves(piece, note);
            const legal = filterLegalMoves(note, pseudo, piece);
            if (legal.length > 0) return false; // Found an escape
        }
    }
    return true;
}

// Checks if the specified color is stalemated (no moves, but not in check)
function isStalemate(color) {
    if (isKingInCheck(color)) return false;

    // Array.from() creates a static snapshot
    const pieces = Array.from(boardState.entries());
    for (let [note, piece] of pieces) {
        if (piece.color === color) {
            const pseudo = getPseudoLegalMoves(piece, note);
            const legal = filterLegalMoves(note, pseudo, piece);
            if (legal.length > 0) return false; 
        }
    }
    return true;
}

// Checks if a pawn has reached the absolute edge of the board in its forward direction
function isPromotionHex(q, r, color) {
    const forwardR = color === 'w' ? r + 1 : r - 1;
    return axialToNotation(q, forwardR) === null;
}

function updateStatus(message) {
    // 1. Update the middle turn display
    const turnText = currentTurn === 'w' ? "White" : "Black";
    turnDisplay.innerText = `${turnText} to move`; 
    
    // 2. Update the right-side status display
    statusDiv.innerText = message;
}

function drawHex(pixelX, pixelY, size, colorIndex, isSelected, isValidMove, isLastMove, isCheck, isHovered) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = i * Math.PI / 3; 
        const x = pixelX + size * Math.cos(angle);
        const y = pixelY + size * Math.sin(angle);
        ctx.lineTo(x, y);
    }
    ctx.closePath();

    // 1. Handle Fills
    if (isCheck) {
        ctx.fillStyle = 'rgba(255, 50, 50, 0.8)';
    } else if (isSelected) {
        ctx.fillStyle = 'rgba(255, 255, 0, 0.5)'; 
    } else if (isValidMove) {
        ctx.fillStyle = 'rgba(0, 150, 255, 0.4)'; 
    } else if (isLastMove) {
        ctx.fillStyle = 'rgba(85, 191, 218, 0.6)'; 
    } else {
        ctx.fillStyle = colors[colorIndex];
    }
    ctx.fill();

    // 2. Handle Edges (Strokes)
    if (isHovered) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
    } else {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }
}

// Converts axial hex coordinates directly to canvas pixel coordinates
function getHexPixels(q, r) {
    const renderQ = isFlipped ? -q : q;
    const renderR = isFlipped ? -r : r;
    return {
        px: (canvas.width / 2) + hexSize * 1.5 * renderQ,
        py: (canvas.height / 2) - hexSize * Math.sqrt(3) * (renderR + renderQ / 2)
    };
}

function trackCapture(capturedPiece, capturingColor) {
    captures[capturingColor].push(capturedPiece.char);
    const elementId = capturingColor === 'w' ? 'white-captures' : 'black-captures';
    document.getElementById(elementId).innerText = captures[capturingColor].join('');
}

function triggerGameOver(title, message) {
    stopTimer();
    playSound('end');
    
    document.getElementById('game-over-title').innerText = title;
    document.getElementById('game-over-message').innerText = message;
    document.getElementById('game-over-modal').classList.remove('hidden');
    
    updateStatus(`Game Over: ${title}`);
}

function resetGame() {
    // Stop any existing timer
    stopTimer();
    
    // Clear logic and history
    boardState.clear();
    positionHistory.clear();
    stateHistory = [];
    currentHistoryIndex = -1;
    
    // Reset game counters
    captures = { w: [], b: [] };
    lastMove = { from: null, to: null };
    moveCount = 1;
    halfMoveClock = 0;
    currentTurn = 'w';
    hasGameStarted = false;

    // Reset UI
    document.getElementById('game-over-modal').classList.add('hidden');
    document.getElementById('white-captures').innerText = '';
    document.getElementById('black-captures').innerText = '';
    moveListElement.innerHTML = '';
    
    // Re-initialize board and parse chosen time control
    parseTimeControl();
    initializeBoard();
    drawBoard();
}

document.getElementById('restart-btn').addEventListener('click', resetGame);
document.getElementById('reset-btn').addEventListener('click', () => {
    if (confirm("Are you sure you want to restart the game?")) resetGame();
});

// --- CHESS CLOCK LOGIC ---
function formatTime(seconds) {
    if (isUnlimited) return "∞";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function updateClockUI() {
    document.getElementById('white-timer').innerText = formatTime(whiteTime);
    document.getElementById('black-timer').innerText = formatTime(blackTime);
    
    if (isUnlimited || !isTimerRunning) {
        document.getElementById('white-timer').classList.remove('active');
        document.getElementById('black-timer').classList.remove('active');
    } else {
        document.getElementById('white-timer').classList.toggle('active', currentTurn === 'w');
        document.getElementById('black-timer').classList.toggle('active', currentTurn === 'b');
    }
}

function tickTimer() {
    if (!isTimerRunning || isUnlimited) return;
    
    if (currentTurn === 'w') whiteTime--;
    else blackTime--;

    updateClockUI();

    if (whiteTime <= 0) {
        stopTimer();
        triggerGameOver("Timeout", "Black wins on time.");
    } else if (blackTime <= 0) {
        stopTimer();
        triggerGameOver("Timeout", "White wins on time.");
    }
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    isTimerRunning = true;
    timerInterval = setInterval(tickTimer, 1000);
    updateClockUI();
}

function stopTimer() {
    isTimerRunning = false;
    if (timerInterval) clearInterval(timerInterval);
    updateClockUI();
}

function parseTimeControl() {
    const tc = document.getElementById('time-control').value;
    if (tc === 'unlimited') {
        isUnlimited = true;
        whiteTime = 0; blackTime = 0; increment = 0;
    } else {
        isUnlimited = false;
        const [m, i] = tc.split('+').map(Number);
        whiteTime = m * 60;
        blackTime = m * 60;
        increment = i;
    }
    updateClockUI();
}

// Reset clocks if the dropdown is changed manually
document.getElementById('time-control').addEventListener('change', () => {
    if (confirm("Changing time controls will restart the game. Proceed?")) resetGame();
    else document.getElementById('time-control').value = isUnlimited ? 'unlimited' : `${whiteTime/60}+${increment}`;
});

function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Pre-calculate check status so we don't run it 91 times
    const wCheck = isKingInCheck('w');
    const bCheck = isKingInCheck('b');

    for (let q = -5; q <= 5; q++) {
        for (let r = -5; r <= 5; r++) {
            if (Math.abs(q + r) > 5) continue;

            const notation = axialToNotation(q, r);
            const { px, py } = getHexPixels(q, r);
            const colorIndex = ((q - r) % 3 + 3) % 3;

            const isSelected = (notation === selectedHex);
            const isValidMove = validMoves.includes(notation);
            const isLastMove = (notation === lastMove.from || notation === lastMove.to);
            const isHovered = (notation === hoveredHex);
            
            // Determine if this specific hex holds a King in check
            let isCheck = false;
            if (notation && boardState.has(notation)) {
                const p = boardState.get(notation);
                if (p.type === 'K') {
                    if (p.color === 'w' && wCheck) isCheck = true;
                    if (p.color === 'b' && bCheck) isCheck = true;
                }
            }
            
            drawHex(px, py, hexSize, colorIndex, isSelected, isValidMove, isLastMove, isCheck, isHovered);

            // [Keep the piece rendering logic here]
            if (notation && boardState.has(notation)) {
                const piece = boardState.get(notation);
                ctx.fillStyle = piece.color === 'w' ? '#ffffff' : '#000000';
                ctx.strokeStyle = piece.color === 'w' ? '#000000' : '#ffffff';
                ctx.lineWidth = 1;
                ctx.font = `${hexSize * 1.4}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.strokeText(piece.char, px, py);
                ctx.fillText(piece.char, px, py);
            }
        }
    }

    ctx.fillStyle = "#ffffff"; 
    ctx.font = `bold ${hexSize * 0.75}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    BOARD_LABELS.forEach(lbl => {
        const coords = notationToAxial(lbl.hex);
        if (!coords) return; 
        const { px, py } = getHexPixels(coords.q, coords.r);
        const xOffset = (isFlipped ? -lbl.xOff : lbl.xOff) * hexSize;
        const yOffset = (isFlipped ? -lbl.yOff : lbl.yOff) * hexSize;
        ctx.fillText(lbl.text, px + xOffset, py + yOffset);
    });
}

// Interaction Logic
// --- CENTRAL MOVE EXECUTION ---
// This function handles the logic for BOTH human and AI moves
function commitMove(from, to) {
    const pieceToMove = boardState.get(from);
    if (!pieceToMove) return false;

    let nextEnPassantTarget = null;
    const endCoords = notationToAxial(to);
    let isCapture = boardState.has(to);

    // 1. Handle Captures
    if (isCapture) trackCapture(boardState.get(to), pieceToMove.color);

    // 2. Pawn Specifics (En Passant & Double Step)
    if (pieceToMove.type === 'P') {
        const startCoords = notationToAxial(from);
        if (to === enPassantTarget) {
            const captureR = pieceToMove.color === 'w' ? endCoords.r - 1 : endCoords.r + 1;
            const capturedPawnHex = axialToNotation(endCoords.q, captureR);
            trackCapture(boardState.get(capturedPawnHex), pieceToMove.color);
            boardState.delete(capturedPawnHex);
            isCapture = true;
        }
        if (Math.abs(endCoords.r - startCoords.r) === 2) {
            const skippedR = pieceToMove.color === 'w' ? startCoords.r + 1 : startCoords.r - 1;
            nextEnPassantTarget = axialToNotation(startCoords.q, skippedR);
        }
    }

    // 3. Update Logic State
    if (pieceToMove.type === 'P' || isCapture) halfMoveClock = 0; else halfMoveClock++;
    
    const moveInfo = `${pieceToMove.type}${from}-${to}`;
    playSound(isCapture ? 'capture' : 'move');

    boardState.set(to, pieceToMove);
    boardState.delete(from);
    enPassantTarget = nextEnPassantTarget;
    lastMove = { from, to };

    // 4. Handle Promotion
    if (pieceToMove.type === 'P' && isPromotionHex(endCoords.q, endCoords.r, pieceToMove.color)) {
        pendingPromotion = { notation: to, color: pieceToMove.color, originalNotation: moveInfo };
        document.getElementById('promotion-modal').classList.remove('hidden');
        selectedHex = null; validMoves = []; drawBoard();
        return true; // Stop here; turn finalizes after modal choice
    }

    // 5. Finalize Turn
    addToMoveLog(moveInfo, pieceToMove.color);
    currentTurn = currentTurn === 'w' ? 'b' : 'w';

    if (!hasGameStarted) {
        hasGameStarted = true;
        startTimer();
    }

    if (!isUnlimited && hasGameStarted) {
        if (pieceToMove.color === 'w') whiteTime += increment;
        else blackTime += increment;
        updateClockUI();
    }

    selectedHex = null;
    validMoves = [];

    // 6. Game Over Checks
    const currentHash = getPositionHash();
    const hashCount = (positionHistory.get(currentHash) || 0) + 1;
    positionHistory.set(currentHash, hashCount);

    if (isCheckmate(currentTurn)) {
        triggerGameOver("Checkmate!", `${pieceToMove.color === 'w' ? 'White' : 'Black'} wins.`);
    } else if (isStalemate(currentTurn)) {
        triggerGameOver("Stalemate", "Draw.");
    } else if (hashCount >= 3) {
        triggerGameOver("Draw", "Threefold Repetition.");
    } else if (halfMoveClock >= 100) {
        triggerGameOver("Draw", "50-Move Rule.");
    } else if (isInsufficientMaterial()) {
        triggerGameOver("Draw", "Insufficient Material.");
    } else {
        updateStatus(isKingInCheck(currentTurn) ? `Check! ${moveInfo}` : `Moved ${moveInfo}`);
        
        // --- AI TRIGGER ---
        if (gameMode !== 'hotseat' && currentTurn === aiSide) {
            setTimeout(requestAiMove, 250);
        }
    }

    saveState();
    drawBoard();
    return true;
}

// --- GET NOTATION FROM MOUSE ---
function getNotationFromMouse(e) {
    const rect = canvas.getBoundingClientRect();
    
    // Calculate position relative to the canvas center
    const px = (e.clientX - rect.left) - (rect.width / 2);
    const py = (e.clientY - rect.top) - (rect.height / 2);

    let qFloat = (2/3 * px) / hexSize;
    let rFloat = (-1/3 * px - Math.sqrt(3)/3 * py) / hexSize;
    let sFloat = -qFloat - rFloat;
    
    let q = Math.round(qFloat), r = Math.round(rFloat), s = Math.round(sFloat);
    const qDiff = Math.abs(q - qFloat), rDiff = Math.abs(r - rFloat), sDiff = Math.abs(s - sFloat);
    
    if (qDiff > rDiff && qDiff > sDiff) q = -r - s; 
    else if (rDiff > sDiff) r = -q - s;

    return axialToNotation(isFlipped ? -q : q, isFlipped ? -r : r);
}

// --- INTERACTION LOGIC ---
canvas.addEventListener('mousedown', (e) => {
    if (pendingPromotion || !document.getElementById('game-over-modal').classList.contains('hidden')) return;
    
    const notation = getNotationFromMouse(e);

    if (notation) {
        if (selectedHex) {
            if (selectedHex === notation) {
                selectedHex = null; validMoves = []; drawBoard();
            } else if (validMoves.includes(notation)) {
                commitMove(selectedHex, notation);
            }
        } else if (boardState.has(notation)) {
            const piece = boardState.get(notation);
            if (piece.color === currentTurn) {
                selectedHex = notation;
                const pseudo = getPseudoLegalMoves(piece, notation);
                validMoves = filterLegalMoves(notation, pseudo, piece);
                drawBoard();
            }
        }
    }
});

// Hover Logic
canvas.addEventListener('mousemove', (e) => {
    const notation = getNotationFromMouse(e);
    
    if (notation !== hoveredHex) {
        hoveredHex = notation;
        if (hoverCoordDisplay) {
            hoverCoordDisplay.innerText = notation ? `Hex: ${notation}` : `Hex: --`;
        }
        drawBoard();
    }
});

canvas.addEventListener('mouseleave', () => {
    hoveredHex = null;
    if (hoverCoordDisplay) {
        hoverCoordDisplay.innerText = `Hex: --`;
    }
    drawBoard();
});

// Controls
flipBtn.addEventListener('click', () => {
    isFlipped = !isFlipped;
    drawBoard();
});

// Promotion UI Logic
document.querySelectorAll('#promotion-options button').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const type = e.target.getAttribute('data-piece');
        const chars = {
            'w': { 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘' },
            'b': { 'Q': '♛', 'R': '♜', 'B': '♝', 'N': '♞' }
        };
        
        const p = pendingPromotion;
        boardState.set(p.notation, { 
            char: chars[p.color][type], 
            type: type, 
            color: p.color 
        });
        
        addToMoveLog(`${p.originalNotation}=${type}`, p.color);

        document.getElementById('promotion-modal').classList.add('hidden');
        pendingPromotion = null;
        
        currentTurn = currentTurn === 'w' ? 'b' : 'w';
        updateStatus(`Promoted to ${type} on ${p.notation}`);
        drawBoard();
        saveState();
    });
});

function addToMoveLog(notation, color) {
    if (color === 'w') {
        const entry = document.createElement('div');
        entry.className = 'move-entry';
        entry.id = `move-${moveCount}`;
        entry.innerHTML = `<span class="move-number">${moveCount}.</span> <span class="white-move">${notation}</span>`;
        moveListElement.appendChild(entry);
    } else {
        const entry = document.getElementById(`move-${moveCount}`);
        if (entry) {
            entry.innerHTML += ` &nbsp;&nbsp; <span class="black-move">${notation}</span>`;
        }
        moveCount++; 
    }
    moveListElement.scrollTop = moveListElement.scrollHeight;
}

// --- FEN STRING GENERATOR ---
function getFEN() {
    const fenRanks = [];
    for (let rank = 11; rank >= 1; rank--) {
        let emptyCount = 0;
        let rankStr = "";
        for (let fileIdx = 0; fileIdx < FILES.length; fileIdx++) {
            const fileChar = FILES[fileIdx];
            const notation = `${fileChar}${rank}`;
            
            if (boardState.has(notation)) {
                if (emptyCount > 0) {
                    rankStr += emptyCount;
                    emptyCount = 0;
                }
                const piece = boardState.get(notation);
                rankStr += piece.color === 'w' ? piece.type.toUpperCase() : piece.type.toLowerCase();
            } else {
                emptyCount++;
            }
        }
        if (emptyCount > 0) {
            rankStr += emptyCount;
        }
        fenRanks.push(rankStr);
    }

    const boardFEN = fenRanks.join('/');
    const castling = '-'; 
    const ep = enPassantTarget || '-';
    return `${boardFEN} ${currentTurn} ${castling} ${ep} ${halfMoveClock} ${moveCount}`;
}

document.getElementById('fen-btn').addEventListener('click', () => {
    const fen = getFEN();
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(fen).then(() => {
            updateStatus("11x11 FEN copied to clipboard!");
        }).catch(err => {
            prompt("Copy FEN:", fen); 
        });
    } else {
        prompt("Copy FEN:", fen);
    }
});

const aiWorker = new Worker('ai-worker.js');

aiWorker.onmessage = function(e) {
    const { type, move, message } = e.data;
    if (type === 'bestmove') executeAiMove(move);
    if (type === 'log') console.log("Engine:", message);
};

function requestAiMove() {
    if (!hasGameStarted) return;
    updateStatus("AI is calculating...");
    
    aiWorker.postMessage({ 
        type: 'search', 
        pieces: Array.from(boardState.entries()), 
        turn: currentTurn,
        ep: enPassantTarget,
        half: halfMoveClock,
        full: moveCount,
        depth: 10 
    });
}

function executeAiMove(uciMove) {
    if (uciMove === '(none)') {
        updateStatus("AI has no moves (Game Over)");
        return;
    }

    const from = uciMove.substring(0, 2);
    const to = uciMove.substring(2, 4);
    const promotion = uciMove.length > 4 ? uciMove[4] : null;

    setTimeout(() => {
        commitMove(from, to);
        
        if (promotion && pendingPromotion) {
            const type = promotion.toUpperCase();
            const chars = {
                'w': { 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘' },
                'b': { 'Q': '♛', 'R': '♜', 'B': '♝', 'N': '♞' }
            };
            const p = pendingPromotion;
            boardState.set(p.notation, { 
                char: chars[p.color][type], 
                type: type, 
                color: p.color 
            });
            document.getElementById('promotion-modal').classList.add('hidden');
            pendingPromotion = null;
            currentTurn = (p.color === 'w') ? 'b' : 'w';
            
            updateStatus(`AI promoted to ${type}`);
            drawBoard();
            saveState();
        }
    }, 600);
}

function resizeCanvas() {
    const wrapper = document.getElementById('canvas-wrapper');
    if (!wrapper) return;
    
    const dpr = window.devicePixelRatio || 1;
    const size = Math.min(wrapper.offsetWidth, wrapper.offsetHeight);
    
    if (size <= 0) return;

    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + "px";
    canvas.style.height = size + "px";
    
    ctx.resetTransform(); 
    ctx.scale(dpr, dpr);
    
    // Reduced scaling factor from 0.95 to 0.85 for label clearance
    hexSize = (size / 11) * 0.85 * (1 / Math.sqrt(3));
    
    drawBoard();
}

window.addEventListener('resize', resizeCanvas);
initializeBoard();
resizeCanvas();