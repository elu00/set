import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useContext, useEffect, useRef, useState } from "react";
import useSound from "use-sound";

import failSfx from "../assets/failedSetSound.mp3";
import foundSfx from "../assets/successfulSetSound.mp3";
import Game from "../components/Game";
import SnackContent from "../components/SnackContent";
import { SettingsContext } from "../context";
import { formatSeconds } from "../formatTime";
import { checkSet, removeCard } from "../gameLogic";

// phase: "playing" (selecting cards) -> "confidence" (found it, asking how
// confident) or "result" (gave up, or confidence just recorded) -> "playing"
// for the next card in the pool.

function StudySession({ pool, markStudyState, onExit }) {
  const { volume } = useContext(SettingsContext);
  const [queueIndex, setQueueIndex] = useState(0);
  const [selected, setSelected] = useState([]);
  const [phase, setPhase] = useState("playing");
  const [revealed, setRevealed] = useState(false);
  const [resultMessage, setResultMessage] = useState("");
  const [snack, setSnack] = useState({ open: false });
  const [tally, setTally] = useState({ confident: 0, needsReview: 0 });
  const [studyDurationMs, setStudyDurationMs] = useState(null);
  const soundOptions = {
    interrupt: true,
    soundEnabled: volume === "on",
  };
  const [playSuccess] = useSound(foundSfx, soundOptions);
  const [playFail] = useSound(failSfx, soundOptions);

  const current = pool[queueIndex];

  const roundStartRef = useRef(Date.now());
  useEffect(() => {
    roundStartRef.current = Date.now();
  }, [queueIndex]);

  function showResult(success, message) {
    if (success) {
      playSuccess();
    } else {
      playFail();
    }
    setSnack({ open: true, variant: success ? "success" : "error", message });
  }

  function handleClick(card) {
    if (phase !== "playing") return;
    if (selected.includes(card)) {
      setSelected(removeCard(selected, card));
      return;
    }
    const cards = [...selected, card];
    if (cards.length < 3) {
      setSelected(cards);
      return;
    }
    if (checkSet(...cards)) {
      setStudyDurationMs(Date.now() - roundStartRef.current);
      showResult(true, "Found a set!");
      setPhase("confidence");
    } else {
      showResult(false, "Not a set!");
    }
    setSelected([]);
  }

  function giveUp() {
    setStudyDurationMs(Date.now() - roundStartRef.current);
    setRevealed(true);
    setResultMessage("Marked as needing more practice.");
    setPhase("result");
    markStudyState(current.id, "needsReview");
    setTally((value) => ({ ...value, needsReview: value.needsReview + 1 }));
  }

  function grade(confident) {
    markStudyState(current.id, confident ? "confident" : "needsReview");
    setTally((value) => ({
      ...value,
      confident: value.confident + (confident ? 1 : 0),
      needsReview: value.needsReview + (confident ? 0 : 1),
    }));
    setResultMessage(
      confident
        ? "Marked as confident — this won't come up again unless you clear stats."
        : "Marked as needing more practice.",
    );
    setPhase("result");
  }

  function next() {
    setQueueIndex((value) => value + 1);
    setSelected([]);
    setPhase("playing");
    setRevealed(false);
    setResultMessage("");
    setStudyDurationMs(null);
    setSnack({ open: false });
  }

  if (!current) {
    return (
      <Container maxWidth="sm" sx={{ py: { xs: 3, sm: 7 } }}>
        <Typography variant="h4" align="center" gutterBottom>
          Study session complete
        </Typography>
        <Typography align="center" color="text.secondary" sx={{ mb: 3 }}>
          {tally.confident} confident, {tally.needsReview} still need work.
        </Typography>
        <Button variant="contained" fullWidth onClick={onExit}>
          Back to stats
        </Button>
      </Container>
    );
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
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Card {queueIndex + 1} of {pool.length}
            </Typography>
            {phase === "playing" && (
              <Button variant="outlined" onClick={giveUp}>
                Give up
              </Button>
            )}
            <Button color="inherit" onClick={onExit}>
              Exit study session
            </Button>
          </Stack>
        </Grid>

        <Grid item xs={12} md={9} order={{ xs: 1, md: 2 }}>
          <Game
            deck={current.board}
            boardSize={current.board.length}
            selected={selected}
            onClick={handleClick}
            onClear={() => setSelected([])}
            gameMode="normal"
            lastSet={[]}
            answer={revealed ? current.cards : null}
          />
          {phase === "confidence" && (
            <Paper sx={{ mt: 2, p: 2, textAlign: "center" }}>
              <Typography color="text.secondary" gutterBottom>
                This time: {formatSeconds(studyDurationMs)} · Originally:{" "}
                {formatSeconds(current.durationMs)}
              </Typography>
              <Typography gutterBottom>Were you confident?</Typography>
              <Stack direction="row" spacing={2} justifyContent="center">
                <Button variant="contained" onClick={() => grade(true)}>
                  Confident
                </Button>
                <Button variant="outlined" onClick={() => grade(false)}>
                  Not confident
                </Button>
              </Stack>
            </Paper>
          )}
          {phase === "result" && (
            <Paper sx={{ mt: 2, p: 2, textAlign: "center" }}>
              <Typography color="text.secondary" gutterBottom>
                This time: {formatSeconds(studyDurationMs)} · Originally:{" "}
                {formatSeconds(current.durationMs)}
              </Typography>
              <Typography gutterBottom>{resultMessage}</Typography>
              <Button variant="contained" onClick={next}>
                Next
              </Button>
            </Paper>
          )}
        </Grid>
      </Grid>
    </Container>
  );
}

export default StudySession;
