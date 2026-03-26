# Hexagonal Chess (Glinski's Variant)

A fully playable, browser-based implementation of Glinski's Hexagonal Chess. This project features a custom-built responsive UI, complete move validation logic, and a work-in-progess AI opponent powered by a forked XL boardsize WebAssembly build of Fairy-Stockfish.

![Hexagonal Chess Screenshot](https://i.imgur.com/91o5Pc6.png) 

## Features

* **Complete Rule Enforcement:** Implements the true Glinski's Hexagonal Chess ruleset, including complex piece movement, En Passant, Pawn promotion, Check, Checkmate, and Stalemate detection.
* **Play vs AI:** Integrated with a custom WebAssembly (WASM) build of Fairy-Stockfish. Play as White or Black against the engine.
* **Local Hotseat Mode:** Play locally against a friend on the same device.
* **Responsive Canvas Rendering:** The hexagonal board is drawn dynamically using the HTML5 Canvas API, ensuring it remains perfectly proportioned and sharp on both 4K desktop monitors and mobile portrait screens.
* **Chess Clocks:** Support for various time controls (e.g., 10+0, 15+10) as well as an Unlimited Time mode.
* **Match Tracking:** Real-time move history log, captured piece tracking, and draw/resign offers.
* **FEN Export:** Generates custom FEN strings based on an 11x11 bounding box layout.
* **Procedural Audio:** Lightweight, synthesized sound effects for moves, captures, and game-over states using the Web Audio API.

## Tech Stack

* **Frontend:** Vanilla HTML5, CSS3 (Flexbox/Grid), Vanilla JavaScript (ES6+)
* **Graphics:** HTML5 `<canvas>` API
* **Engine:** [Fairy-Stockfish](https://github.com/ianfab/Fairy-Stockfish) compiled to WebAssembly (WASM)
* **Concurrency:** Web Workers (for non-blocking AI calculation)
* **Cross-Origin Isolation:** `coi-serviceworker.js` (to enable `SharedArrayBuffer` requirements for the engine)

## Project Structure

* `index.html` - The main layout, UI elements, and modal containers.
* `style.css` - Responsive styling, CSS variables for theming, and mobile breakpoints.
* `logic.js` - Core game state, axial coordinate math, move generation algorithms, rendering loops, and UI event listeners.
* `ai-worker.js` - The Web Worker script that bridges the main thread and the Stockfish engine.
* `stockfish.js` & `stockfish.wasm` - The compiled Fairy-Stockfish engine files.
* `coi-serviceworker.js` - A script that injects necessary headers to allow WebAssembly multi-threading in the browser.

## How to Play Online

#### https://spacenavy90.github.io/hex_chess_app/

## How to Run Locally

Because this project utilizes Web Workers and WebAssembly (which require strict Cross-Origin Isolation policies like `SharedArrayBuffer`), **you cannot run this by simply double-clicking the `index.html` file.** You must serve the files through a local web server.

### VS Code Live Server (Recommended)
1. Open the project folder in Visual Studio Code.
2. Install the [Live Server extension](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer).
3. Click **"Go Live"** in the bottom right corner of the editor.