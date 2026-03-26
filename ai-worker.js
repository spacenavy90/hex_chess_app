self.importScripts('stockfish.js');

let engine = null;

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'k', 'l'];
const ENGINE_FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k']; 

function notationToEngine(notation) {
    if (!notation || notation === '-') return '-';
    const fileChar = notation.charAt(0);
    const rank = parseInt(notation.substring(1));
    const q = FILES.indexOf(fileChar) - 5;
    const r = rank - 6 - Math.min(0, q);
    
    const x = q + r + 5;
    const y = r + 5;
    return `${ENGINE_FILES[x]}${y + 1}`;
}

function engineToNotation(uciSquare) {
    const x = ENGINE_FILES.indexOf(uciSquare.charAt(0));
    const y = parseInt(uciSquare.substring(1)) - 1;
    
    const r = y - 5;
    const q = x - y;
    
    const fileChar = FILES[q + 5];
    const rank = r + 6 + Math.min(0, q);
    return `${fileChar}${rank}`;
}

// 11x11 Rhombus Config with Explicit FEN Holes (*)
const glinskiConfig = `
[glinskiHex]
# [glinskiHex:fairy]
# variantTemplate = chess
maxFile = 11
maxRank = 11

# The holes (*) in the FEN define the bounds of the board for the engine.
startFen = *****1prnqb/****2p2bk/***3p1b1n/**4p3r/*5ppppp/11/PPPPP5*/R3P4**/N1B1P3***/QB2P2****/BKNRP1***** w - - 0 1

promotionRegionWhite = f11 g11 h11 i11 j11 k11 k10 k9 k8 k7 k6
promotionRegionBlack = a6 a5 a4 a3 a2 a1 b1 c1 d1 e1 f1

doubleStepRegionWhite = a5 b5 c5 d5 e5 e4 e3 e2 e1
doubleStepRegionBlack = g11 g10 g9 g8 g7 h7 i7 j7 k7

# Redefining the base pieces as strictly custom pieces to override all default behavior
customPiece1 = r:RfrBblB
customPiece2 = b:flBbrBfrN0rfN0blN0lbN0
customPiece3 = q:RfrBblBflBbrBfrN0rfN0blN0lbN0
customPiece4 = n:rbNlfNflNbrNrfClbCfrCblCfrZrfZblZlbZ
customPiece5 = p:mfrFcfWcrW

# The king can be overridden directly per the documentation
king = k:WfrFblFflFbrFfrNrfNblNlbN

# Explicitly defining the structural roles of our new custom pieces
pawnTypes = p
promotionPieceTypes = qrbn

castling = false
`;

Stockfish({
    mainScriptUrlOrBlob: 'stockfish.js',
    locateFile: function(path) { return path; }
}).then((instance) => {
    engine = instance;

    engine.FS.writeFile('/variants.ini', glinskiConfig);

    engine.addMessageListener((line) => {
        if (line.startsWith('bestmove')) {
            const match = line.match(/bestmove\s+([a-k][0-9]+)([a-k][0-9]+)([qrbn]?)/i);
            if (match) {
                const from = engineToNotation(match[1]);
                const to = engineToNotation(match[2]);
                const promo = match[3] || '';
                self.postMessage({ type: 'bestmove', move: `${from}${to}${promo}` });
            } else {
                self.postMessage({ type: 'bestmove', move: '(none)' });
            }
        }
        self.postMessage({ type: 'log', message: line });
    });

    engine.postMessage('uci');
    engine.postMessage('setoption name VariantPath value /variants.ini');
    engine.postMessage('setoption name UCI_Variant value glinski');
    engine.postMessage('isready');
});

self.onmessage = function(e) {
    if (!engine) return;

    if (e.data.type === 'search') {
        const { pieces, turn, ep, half, full } = e.data;
        const board = new Map(pieces);
        
        const fenRanks = [];
        for (let y = 10; y >= 0; y--) {
            let emptyCount = 0;
            let rankStr = "";
            for (let x = 0; x < 11; x++) {
                const r = y - 5;
                const q = x - y;
                
                // Keep the exact same hole structure as the startFen
                if (Math.abs(q) <= 5 && Math.abs(r) <= 5 && Math.abs(q + r) <= 5) {
                    const notation = engineToNotation(`${ENGINE_FILES[x]}${y + 1}`);
                    if (notation && board.has(notation)) {
                        if (emptyCount > 0) { rankStr += emptyCount; emptyCount = 0; }
                        const p = board.get(notation);
                        rankStr += p.color === 'w' ? p.type.toUpperCase() : p.type.toLowerCase();
                    } else {
                        emptyCount++;
                    }
                } else {
                    if (emptyCount > 0) { rankStr += emptyCount; emptyCount = 0; }
                    rankStr += '*';
                }
            }
            if (emptyCount > 0) rankStr += emptyCount;
            fenRanks.push(rankStr);
        }

        const fen = `${fenRanks.join('/')} ${turn} - ${notationToEngine(ep)} ${half} ${full}`;
        engine.postMessage(`position fen ${fen}`);
        engine.postMessage(`go depth ${e.data.depth}`);
    }
};