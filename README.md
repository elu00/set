# Set with Friends — Offline

This repository contains a single-player implementation of the card game Set.
The game runs entirely in the browser: it has no accounts, multiplayer rooms,
database, cloud functions, analytics, or other runtime network dependency.

The original visual design, card renderer, themes, sounds, and keyboard layouts
are retained. A player can immediately start or restart a standard game, select
cards with the mouse or keyboard, request hints, rotate the cards, flip the
board, and change local display settings. Alternative game modes remain
available behind the secondary mode chooser. The timer also projects a
full-deck completion time from the player's current pace.

## Static deployment

The Vite build produces a self-contained `dist/` directory with relative asset
URLs. Deploy that directory to any static host.

Pushes to `main` automatically build and deploy the site to GitHub Pages using
the workflow in `.github/workflows/deploy.yml`. In the repository's GitHub
settings, set **Pages → Build and deployment → Source** to **GitHub Actions**.
The published site will be available at
<https://elu00.github.io/set/>.

On a development machine with the project's Node toolchain available, the
usual scripts are:

```bash
npm run dev
npm run build
npm test
```

No package installation or build was performed as part of the offline port on
the target machine, because npm is intentionally unavailable there.

## Controls

- Click cards, or use the keys matching their positions, to select them.
- Press Escape to clear the selection.
- Use the layout-specific orientation keys shown by the keyboard-layout
  setting, or use the on-screen controls.
- Press Ctrl+Enter after a completed game to play again.

## License

Built from the original Set with Friends project by Eric Zhang and Cynthia Du.
All source code is available under the [MIT License](LICENSE.txt). This project
is not affiliated with Set Enterprises, Inc. or the SET® card game.
