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

## Reopening offline

The production build automatically saves the complete app with a service worker,
including its HTML, JavaScript, styles, images, and sounds. Serve it over HTTPS
(GitHub Pages already does), or use a localhost server for testing. Opening
`index.html` directly as a `file://` URL does not enable offline caching.

1. Open the deployed site while online. Wait for **Available offline** on the
   start screen before closing the browser or disconnecting.
2. Optionally select **Keep offline copy** to ask the browser for persistent
   storage. Some browsers show a permission prompt; others decide automatically.
   A denial does not prevent offline use, but leaves the copy eligible for
   automatic removal when the browser needs space.
3. Bookmark the full address, including its trailing slash (for example,
   `https://elu00.github.io/set/`). Reopen that address in the same browser profile
   after restarting the browser, even without a network connection.

Normal browser restarts preserve the offline copy. Private browsing, clearing
site data, browser settings that delete data on exit, and browser storage
eviction can remove it. Persistent storage reduces automatic eviction; a website
cannot force the browser to retain its data forever.

New deployments download a complete, separately versioned copy in the background
on a later online visit. An update takes over after all existing tabs for this
app close, so a running game is not interrupted. If a download fails, the previous
offline version remains available. Caches for other apps on the same origin are
left alone.

Offline caching is disabled in `npm run dev`. To test it, run `npm run build`
and `npm run preview`, visit the preview while online, wait for the ready message,
then fully quit the browser, stop the preview server, and reopen the same URL in
the same browser profile. Starting a game, changing settings, and playing sounds
should still work. The build generates `dist/sw.js`; deploy it with the rest of
`dist/`.

## Controls

- Click cards, or use the keys matching their positions, to select them.
- Press Escape to clear the selection.
- Use the layout-specific orientation keys shown by the keyboard-layout
  setting, or use the on-screen controls.
- Press Ctrl+Enter after a completed game to play again.
- Use **Pause** next to the clock to stop timing. Clicking, using the keyboard,
  changing a setting, or highlighting a card resumes automatically; **Resume**
  also resumes directly. Pausing preserves your selected cards, and the action
  that resumes play still takes effect.

The game clock shows active playing time, excluding pauses. Statistics and pace
estimates count at most 120 seconds per move, including completed-game totals
(the sum of capped move times). Existing saved moves are capped when calculating
statistics, and existing completion times are adjusted for their session's
recorded excess time, without rewriting history.

## Lifetime set coverage

The game sidebar and statistics screen show **Unique found** and **Unique
appeared**, each out of all possible sets (1,080 for a standard deck). These
totals accumulate across games and browser restarts. A set is identified by its
cards, regardless of selection order; repeats count once.

Every valid set available on a dealt board counts as appeared, including sets
you never select and boards from games you later abandon. Successful finds,
including in study sessions, count as found. Three-card modes share the same
collection; Junior displays its 117 eligible combinations, and UltraSet tracks
its separate collection of 63,180 four-card combinations. In Set-Chain, only sets
playable under the chain rule count as appeared.

Existing saved finds and the boards recorded with them are included automatically.
Earlier abandoned boards were not stored and cannot be recovered. **Clear stats**
resets these lifetime totals along with the timing history.

## License

Built from the original Set with Friends project by Eric Zhang and Cynthia Du.
All source code is available under the [MIT License](LICENSE.txt). This project
is not affiliated with Set Enterprises, Inc. or the SET® card game.
