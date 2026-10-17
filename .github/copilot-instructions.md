# Repository guide

## Language

Respond to the user in Japanese, including explanations and summaries.

## Project structure and architecture

Skybound is a dependency-free browser game implemented with plain HTML, CSS, and JavaScript. `index.html` defines the Japanese-language page, HUD, canvas, start/end message, and touch controls; it loads `style.css` and `game.js`. `game.js` owns the game state and loop: it updates player physics, platforms, coins, enemy collisions, camera position, and HUD, then draws the world on the canvas. `style.css` styles the surrounding interface and makes it responsive, including showing touch controls on narrow screens.

The canvas uses a fixed 960×540 coordinate space, while CSS scales it to fit its container. World positions and level layout are in `game.js`; keep physics and drawing coordinates in that canvas/world coordinate system.

## Commands

There is no package manifest, build system, test suite, or configured linter. Open `index.html` in a browser to run the game. To check JavaScript syntax, run:

```sh
node --check game.js
```

There is no single-test command because the repository has no automated tests.

## Repository conventions

- Keep the implementation framework-free and split page markup, presentation, and game behavior among `index.html`, `style.css`, and `game.js`.
- Keep level geometry and collectible placement as data near the top of `game.js`; tune game physics using its shared constants rather than scattered values.
- The canvas is the source of truth for gameplay rendering; DOM elements are used for the HUD and start/completion overlay.
- Preserve both keyboard and pointer/touch controls when changing player input. Keyboard aliases and touch button IDs are mapped in `game.js`, with their labels and accessibility text in `index.html`.
- Player-facing page text is Japanese, and the document language is `ja`.
