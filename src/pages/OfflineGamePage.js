import AlarmIcon from "@mui/icons-material/Alarm";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import makeStyles from "@mui/styles/makeStyles";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import useSound from "use-sound";

import failSfx from "../assets/failedSetSound.mp3";
import foundSfx from "../assets/successfulSetSound.mp3";
import Game from "../components/Game";
import OfflineStatus from "../components/OfflineStatus";
import SnackContent from "../components/SnackContent";
import { SettingsContext } from "../context";
import { formatTime } from "../formatTime";
import {
  checkSet,
  checkSetUltra,
  computeState,
  findSet,
  generateCards,
  modes,
  removeCard,
} from "../gameLogic";
import {
  createTimer,
  elapsedTime,
  moveTiming,
  pauseTimer,
  resumeTimer,
} from "../gameTiming";
import useKeydown from "../hooks/useKeydown";
import useNormalModeStats from "../hooks/useNormalModeStats";
import StatsPage from "./StatsPage";
import StudySession from "./StudySession";

const PLAYER_ID = "player";

const useStyles = makeStyles((theme) => ({
  mainColumn: {
    display: "flex",
    alignItems: "center",
  },
  sidebar: {
    maxHeight: "100%",
    display: "flex",
    flexDirection: "column",
    padding: 8,
  },
  timer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  alarm: {
    color: theme.custom.alarm,
    marginRight: 10,
    marginBottom: 3,
  },
  score: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  doneOverlay: {
    position: "absolute",
    inset: 8,
    borderRadius: 4,
    background: "rgba(0, 0, 0, 0.55)",
    zIndex: 1,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  doneModal: {
    padding: theme.spacing(3),
    textAlign: "center",
  },
}));

function shuffleDeck() {
  const deck = generateCards();
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function StartScreen({ initialMode, onStart, onViewStats }) {
  const [mode, setMode] = useState(initialMode);
  const [choosingMode, setChoosingMode] = useState(false);

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 3, sm: 7 } }}>
      <Typography variant="h3" align="center" gutterBottom>
        Play Set offline
      </Typography>
      <Typography color="text.secondary" align="center" sx={{ mb: 4 }}>
        Everything runs in this browser, with no account required.
      </Typography>
      <Button
        variant="contained"
        size="large"
        fullWidth
        onClick={() => onStart(mode)}
      >
        Start game
      </Button>
      <Button
        color="inherit"
        size="small"
        fullWidth
        sx={{ mt: 1 }}
        onClick={() => setChoosingMode(true)}
      >
        {mode === "normal"
          ? "Choose another mode"
          : `Mode: ${modes[mode].name}`}
      </Button>
      <Button
        color="inherit"
        size="small"
        fullWidth
        sx={{ mt: 1 }}
        onClick={onViewStats}
      >
        View stats
      </Button>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        Select cards by clicking them or using the keyboard. Escape clears your
        selection. The board and card orientation keys are determined by your
        keyboard layout.
      </Typography>
      <OfflineStatus />
      <Dialog open={choosingMode} onClose={() => setChoosingMode(false)}>
        <DialogTitle>Choose game mode</DialogTitle>
        <DialogContent>
          <RadioGroup
            value={mode}
            onChange={(event) => setMode(event.target.value)}
          >
            {Object.entries(modes).map(([key, value]) => (
              <FormControlLabel
                key={key}
                value={key}
                control={<Radio />}
                label={
                  <span>
                    <strong>{value.name}</strong>
                    <br />
                    <Typography component="span" color="text.secondary">
                      {value.description}
                    </Typography>
                  </span>
                }
              />
            ))}
          </RadioGroup>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setChoosingMode(false)}>Done</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

function ActiveGame({ initialMode, onExit, onFind }) {
  const classes = useStyles();
  const { volume, toggleCardOrientation, toggleLayoutOrientation } =
    useContext(SettingsContext);
  const [game, setGame] = useState(() => ({
    deck: shuffleDeck(),
    events: [],
    mode: initialMode,
    startedAt: Date.now(),
  }));
  const [selected, setSelected] = useState([]);
  const [numHints, setNumHints] = useState(0);
  const [snack, setSnack] = useState({ open: false });
  const [now, setNow] = useState(Date.now());
  const [paused, setPaused] = useState(false);
  const timerRef = useRef(createTimer(game.startedAt));
  const soundOptions = {
    interrupt: true,
    soundEnabled: volume === "on",
  };
  const [playSuccess] = useSound(foundSfx, soundOptions);
  const [playFail] = useSound(failSfx, soundOptions);

  const state = useMemo(
    () => computeState({ deck: game.deck, events: game.events }, game.mode),
    [game],
  );
  const { current, history, boardSize } = state;
  const lastSet = useMemo(() => {
    if (game.mode !== "setchain" || history.length === 0) return [];
    const { c1, c2, c3 } = history[history.length - 1];
    return [c1, c2, c3];
  }, [game.mode, history]);
  const availableSet = findSet(current.slice(0, boardSize), game.mode, lastSet);
  const done = !availableSet;
  const elapsed =
    done && history.length
      ? history[history.length - 1].elapsedMs
      : elapsedTime(timerRef.current, now);
  const { statsElapsedMs } = moveTiming(history, elapsed);
  const totalCards = game.mode === "setjr" ? 27 : game.deck.length;
  const cardsRemoved = totalCards - current.length;
  const estimatedFinish = cardsRemoved
    ? (statsElapsedMs / cardsRemoved) * totalCards
    : null;
  const maxHints = game.mode === "ultraset" ? 4 : 3;
  const answer = availableSet ? availableSet.slice(0, numHints) : null;

  useEffect(() => {
    if (done || paused) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [done, paused]);

  const resumeGame = useCallback(() => {
    if (done || timerRef.current.pausedAt === null) return;
    const resumedAt = Date.now();
    // Update synchronously so a card selection that resumes play also uses
    // the corrected clock when it completes a set in the same event.
    timerRef.current = resumeTimer(timerRef.current, resumedAt);
    setPaused(false);
    setNow(resumedAt);
  }, [done]);

  function pauseGame() {
    const pausedAt = Date.now();
    timerRef.current = pauseTimer(timerRef.current, pausedAt);
    setPaused(true);
    setNow(pausedAt);
  }

  useEffect(() => {
    if (!paused || done) return;
    const resumeOnAction = (event) => {
      if (
        event.target.closest?.("[data-pause-control]") &&
        (event.type !== "keydown" ||
          event.key === "Enter" ||
          event.key === " ")
      ) {
        return;
      }
      resumeGame();
    };
    const events = ["pointerdown", "click", "keydown", "input", "change"];
    events.forEach((type) =>
      window.addEventListener(type, resumeOnAction, true),
    );
    return () => {
      events.forEach((type) =>
        window.removeEventListener(type, resumeOnAction, true),
      );
    };
  }, [done, paused, resumeGame]);

  const startNewGame = useCallback(() => {
    const startedAt = Date.now();
    timerRef.current = createTimer(startedAt);
    setGame({
      deck: shuffleDeck(),
      events: [],
      mode: initialMode,
      startedAt,
    });
    setSelected([]);
    setNumHints(0);
    setSnack({ open: false });
    setNow(startedAt);
    setPaused(false);
  }, [initialMode]);

  useKeydown((event) => {
    if (event.ctrlKey && event.key === "Enter" && done) startNewGame();
  });

  function showResult(success, message) {
    if (success) {
      playSuccess();
    } else {
      playFail();
    }
    setSnack({ open: true, variant: success ? "success" : "error", message });
  }

  function recordSet(cards) {
    const time = Date.now();
    const elapsedMs = elapsedTime(timerRef.current, time);
    const timing = moveTiming(history, elapsedMs);
    const event = {
      c1: cards[0],
      c2: cards[1],
      c3: cards[2],
      user: PLAYER_ID,
      time,
      elapsedMs,
      durationMs: timing.durationMs,
    };
    if (cards[3]) event.c4 = cards[3];
    if (game.mode === "normal" && onFind) {
      const nextState = computeState(
        { deck: game.deck, events: [...game.events, event] },
        game.mode,
      );
      const gameComplete = !findSet(
        nextState.current.slice(0, nextState.boardSize),
        game.mode,
      );
      const findRecord = {
        sessionId: game.startedAt,
        findIndex: history.length,
        time: event.time,
        durationMs: timing.durationMs,
        board: current.slice(0, boardSize),
        cards: [cards[0], cards[1], cards[2]],
      };
      if (gameComplete) {
        findRecord.finishDurationMs = timing.statsElapsedMs;
      }
      onFind(findRecord);
    }
    setGame((value) => ({ ...value, events: [...value.events, event] }));
    setNow(time);
    setNumHints(0);
  }

  function handleClick(card) {
    if (done) return;
    resumeGame();
    if (selected.includes(card)) {
      setSelected(removeCard(selected, card));
      return;
    }

    if (game.mode === "normal" || game.mode === "setjr") {
      const cards = [...selected, card];
      if (cards.length < 3) {
        setSelected(cards);
        return;
      }
      if (checkSet(...cards)) {
        recordSet(cards);
        showResult(true, "Found a set!");
      } else {
        showResult(false, "Not a set!");
      }
      setSelected([]);
      return;
    }

    if (game.mode === "ultraset") {
      const cards = [...selected, card];
      if (cards.length < 4) {
        setSelected(cards);
        return;
      }
      const orderedCards = checkSetUltra(...cards);
      if (orderedCards) {
        recordSet(orderedCards);
        showResult(true, "Found an UltraSet!");
      } else {
        showResult(false, "Not an UltraSet!");
      }
      setSelected([]);
      return;
    }

    let cards;
    if (lastSet.includes(card)) {
      cards =
        selected.length > 0 && lastSet.includes(selected[0])
          ? [card, ...selected.slice(1)]
          : [card, ...selected];
    } else {
      cards = [...selected, card];
    }
    if (cards.length < 3) {
      setSelected(cards);
      return;
    }
    if (lastSet.length > 0 && !lastSet.includes(cards[0])) {
      showResult(false, "One card must be from the previous set!");
    } else if (checkSet(...cards)) {
      recordSet(cards);
      showResult(true, "Found a set chain!");
    } else {
      showResult(false, "Not a set chain!");
    }
    setSelected([]);
  }

  return (
    <Container sx={{ pb: 3 }}>
      <Snackbar
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        open={snack.open}
        autoHideDuration={2000}
        onClose={(_, reason) => {
          if (reason !== "clickaway")
            setSnack((value) => ({ ...value, open: false }));
        }}
      >
        <SnackContent
          variant={snack.variant || "info"}
          message={snack.message || ""}
          onClose={() => setSnack((value) => ({ ...value, open: false }))}
        />
      </Snackbar>
      <Grid container spacing={2}>
        <Grid item xs={12} md={3} order={{ xs: 3, md: 1 }}>
          <Stack spacing={2}>
            <Button
              variant="outlined"
              disabled={selected.length === 0}
              onClick={() => setSelected([])}
            >
              Clear selection
            </Button>
            <Button
              variant="outlined"
              disabled={done || numHints === maxHints}
              onClick={() =>
                setNumHints((value) => Math.min(maxHints, value + 1))
              }
            >
              Add hint: {numHints}
            </Button>
            <Button variant="outlined" onClick={toggleCardOrientation}>
              Rotate cards
            </Button>
            <Button variant="outlined" onClick={toggleLayoutOrientation}>
              Flip board layout
            </Button>
            <Button variant="outlined" onClick={startNewGame}>
              Restart game
            </Button>
            <Button color="inherit" onClick={onExit}>
              Change mode
            </Button>
          </Stack>
        </Grid>

        <Grid
          item
          xs={12}
          md={6}
          order={{ xs: 1, md: 2 }}
          position="relative"
          className={classes.mainColumn}
        >
          {done && (
            <div className={classes.doneOverlay}>
              <Paper elevation={3} className={classes.doneModal}>
                <Typography variant="h5">Game complete</Typography>
                <Typography sx={{ mt: 1 }}>
                  You found {history.length}{" "}
                  {history.length === 1 ? "set" : "sets"} in{" "}
                  {formatTime(elapsed, false)}.
                </Typography>
                <Button
                  variant="contained"
                  sx={{ mt: 2 }}
                  onClick={startNewGame}
                >
                  Play again
                </Button>
              </Paper>
            </div>
          )}
          <Game
            deck={current}
            boardSize={boardSize}
            selected={selected}
            onClick={handleClick}
            onInteract={resumeGame}
            onClear={() => setSelected([])}
            gameMode={game.mode}
            lastSet={lastSet}
            answer={answer}
          />
        </Grid>

        <Grid item xs={12} md={3} order={{ xs: 2, md: 3 }}>
          <Paper className={classes.sidebar}>
            <div className={classes.timer} style={{ marginTop: 6 }}>
              <AlarmIcon className={classes.alarm} fontSize="large" />
              <Typography variant="h4" align="center">
                {formatTime(elapsed, !done)}
              </Typography>
            </div>
            <Button
              data-pause-control="true"
              startIcon={paused ? <PlayArrowIcon /> : <PauseIcon />}
              onClick={paused ? resumeGame : pauseGame}
              disabled={done}
              aria-pressed={paused}
            >
              {paused ? "Resume" : "Pause"}
            </Button>
            {paused && (
              <Typography variant="caption" align="center" role="status">
                Paused. Any action or card highlight resumes play.
              </Typography>
            )}
            <Divider style={{ margin: "8px 0" }} />
            <Typography variant="subtitle1">
              <strong>Scoreboard</strong>
            </Typography>
            <div className={classes.score}>
              <Typography variant="body2">Player</Typography>
              <Typography variant="body2">
                <strong>{history.length}</strong>
              </Typography>
            </div>
            <Typography variant="body2" color="text.secondary">
              {modes[game.mode].name}
            </Typography>
            <Divider style={{ margin: "8px 0" }} />
            <Typography variant="subtitle1">
              <strong>Pace</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Estimated full-deck time
            </Typography>
            <Typography variant="h5">
              {estimatedFinish === null ? "—" : formatTime(estimatedFinish)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Statistics count at most 120 seconds per move.
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}

function OfflineGamePage() {
  const [playing, setPlaying] = useState(false);
  const [mode, setMode] = useState("normal");
  const [studyPool, setStudyPool] = useState(null);
  const [viewingStats, setViewingStats] = useState(false);
  const stats = useNormalModeStats();

  function startGame(selectedMode) {
    setMode(selectedMode);
    setPlaying(true);
  }

  if (viewingStats) {
    return (
      <StatsPage
        stats={stats}
        onBack={() => setViewingStats(false)}
        onStartStudy={(pool) => {
          setViewingStats(false);
          setStudyPool(pool);
        }}
      />
    );
  }

  if (studyPool) {
    return (
      <StudySession
        pool={studyPool}
        markStudyState={stats.markStudyState}
        onExit={() => setStudyPool(null)}
      />
    );
  }

  return playing ? (
    <ActiveGame
      initialMode={mode}
      onExit={() => setPlaying(false)}
      onFind={stats.recordFind}
    />
  ) : (
    <StartScreen
      initialMode={mode}
      onStart={startGame}
      onViewStats={() => setViewingStats(true)}
    />
  );
}

export default OfflineGamePage;
