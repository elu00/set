import AlarmIcon from "@mui/icons-material/Alarm";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import makeStyles from "@mui/styles/makeStyles";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import useSound from "use-sound";

import failSfx from "../assets/failedSetSound.mp3";
import foundSfx from "../assets/successfulSetSound.mp3";
import Game from "../components/Game";
import SnackContent from "../components/SnackContent";
import { SettingsContext } from "../context";
import useKeydown from "../hooks/useKeydown";
import {
  checkSet,
  checkSetUltra,
  computeState,
  findSet,
  generateCards,
  modes,
  removeCard,
} from "../gameLogic";

const PLAYER_ID = "player";

const useStyles = makeStyles((theme) => ({
  mainColumn: {
    display: "flex",
    alignItems: "center",
  },
  panel: {
    padding: theme.spacing(2),
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

function formatElapsed(milliseconds) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const clock = `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
  return hours ? `${hours}:${clock.padStart(5, "0")}` : clock;
}

function StartScreen({ onStart }) {
  const [mode, setMode] = useState("normal");

  return (
    <Container maxWidth="md" sx={{ py: { xs: 3, sm: 7 } }}>
      <Typography variant="h3" align="center" gutterBottom>
        Play Set offline
      </Typography>
      <Typography color="text.secondary" align="center" sx={{ mb: 4 }}>
        Choose a mode. Everything runs in this browser—no account or connection
        is required.
      </Typography>
      <Grid container spacing={2}>
        {Object.entries(modes).map(([key, value]) => (
          <Grid item xs={12} sm={6} key={key}>
            <Card
              variant="outlined"
              sx={{
                height: "100%",
                borderColor: key === mode ? "primary.main" : undefined,
                borderWidth: key === mode ? 2 : 1,
              }}
            >
              <CardActionArea
                onClick={() => setMode(key)}
                sx={{ height: "100%" }}
              >
                <CardContent>
                  <Typography variant="h6">{value.name}</Typography>
                  <Typography color="text.secondary">
                    {value.description}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
      <Button
        variant="contained"
        size="large"
        fullWidth
        sx={{ mt: 3 }}
        onClick={() => onStart(mode)}
      >
        Start game
      </Button>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        Select cards by clicking them or using the keyboard. Escape clears your
        selection. The board and card orientation keys are determined by your
        keyboard layout.
      </Typography>
    </Container>
  );
}

function ActiveGame({ initialMode, onExit }) {
  const classes = useStyles();
  const {
    volume,
    toggleCardOrientation,
    toggleLayoutOrientation,
  } = useContext(SettingsContext);
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
  const [playSuccess] = useSound(foundSfx);
  const [playFail] = useSound(failSfx);

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
  const availableSet = findSet(
    current.slice(0, boardSize),
    game.mode,
    lastSet,
  );
  const done = !availableSet;
  const completedAt =
    done && history.length ? history[history.length - 1].time : now;
  const maxHints = game.mode === "ultraset" ? 4 : 3;
  const answer = availableSet ? availableSet.slice(0, numHints) : null;

  useEffect(() => {
    if (done) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [done]);

  const startNewGame = useCallback(() => {
    setGame({
      deck: shuffleDeck(),
      events: [],
      mode: initialMode,
      startedAt: Date.now(),
    });
    setSelected([]);
    setNumHints(0);
    setSnack({ open: false });
    setNow(Date.now());
  }, [initialMode]);

  useKeydown((event) => {
    if (event.ctrlKey && event.key === "Enter" && done) startNewGame();
  });

  function showResult(success, message) {
    if (volume === "on") (success ? playSuccess : playFail)();
    setSnack({ open: true, variant: success ? "success" : "error", message });
  }

  function recordSet(cards) {
    const event = {
      c1: cards[0],
      c2: cards[1],
      c3: cards[2],
      user: PLAYER_ID,
      time: Date.now(),
    };
    if (cards[3]) event.c4 = cards[3];
    setGame((value) => ({ ...value, events: [...value.events, event] }));
    setNumHints(0);
  }

  function handleClick(card) {
    if (done) return;
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
        <Grid item xs={12} md={3} order={{ xs: 2, md: 1 }}>
          <Paper className={classes.panel}>
            <Stack direction="row" spacing={1} alignItems="center">
              <AlarmIcon color="error" />
              <Typography variant="h4">
                {formatElapsed(completedAt - game.startedAt)}
              </Typography>
            </Stack>
            <Typography variant="h6" sx={{ mt: 2 }}>
              Score: {history.length}
            </Typography>
            <Typography color="text.secondary">
              Mode: {modes[game.mode].name}
            </Typography>
          </Paper>
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
                  {formatElapsed(completedAt - game.startedAt)}.
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
            onClear={() => setSelected([])}
            gameMode={game.mode}
            lastSet={lastSet}
            answer={answer}
          />
        </Grid>

        <Grid item xs={12} md={3} order={{ xs: 3, md: 3 }}>
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
      </Grid>
    </Container>
  );
}

function OfflineGamePage() {
  const [mode, setMode] = useState(null);
  return mode ? (
    <ActiveGame initialMode={mode} onExit={() => setMode(null)} />
  ) : (
    <StartScreen onStart={setMode} />
  );
}

export default OfflineGamePage;
