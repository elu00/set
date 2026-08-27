import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import LinearProgress from "@mui/material/LinearProgress";
import Slider from "@mui/material/Slider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useMemo, useState } from "react";

import DurationHistogram from "../components/DurationHistogram";
import HypercubeGrid from "../components/HypercubeGrid";
import { formatSeconds } from "../formatTime";
import {
  ATTRIBUTE_NAMES,
  MIN_SAMPLE_SIZE,
  computeAttributeEffectBySameCount,
  computeBoardSizeTiers,
  computeDifferenceTiers,
  durationHistogram,
  hasEnoughData,
  percentileAtThreshold,
  selectStudyPool,
} from "../statsLogic";

const MAX_SLIDER_SECONDS = 120;
const DEFAULT_THRESHOLD_SECONDS = 10;

// Wraps a number that changes often (a percentage, a live count) in a
// fixed-width, right-aligned box so the surrounding sentence doesn't
// reflow as the digit count changes.
function FixedNumber({ children, minWidth = "2.5ch" }) {
  return (
    <Box
      component="span"
      sx={{
        display: "inline-block",
        minWidth,
        textAlign: "right",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {children}
    </Box>
  );
}

function TierBars({ items }) {
  const max = Math.max(
    1,
    ...items.filter((item) => item.count > 0).map((item) => item.meanMs),
  );
  return (
    <Box>
      {items.map((item) => (
        <Box
          key={item.label}
          sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}
        >
          <Typography variant="body2" sx={{ width: 130 }}>
            {item.label}
          </Typography>
          {item.count === 0 ? (
            <Typography variant="caption" color="text.secondary">
              no data yet
            </Typography>
          ) : (
            <>
              <Box
                sx={{
                  flexGrow: 1,
                  height: 8,
                  bgcolor: "action.hover",
                  borderRadius: 1,
                  overflow: "hidden",
                }}
              >
                <Box
                  sx={{
                    width: `${(item.meanMs / max) * 100}%`,
                    height: "100%",
                    bgcolor: "primary.main",
                  }}
                />
              </Box>
              <Typography
                variant="caption"
                sx={{ width: 160, textAlign: "right" }}
              >
                {formatSeconds(item.meanMs)} ± {formatSeconds(item.stdDevMs)} (
                {item.count})
              </Typography>
            </>
          )}
        </Box>
      ))}
    </Box>
  );
}

function DifferenceTiersSection({ finds }) {
  const tiers = useMemo(() => computeDifferenceTiers(finds), [finds]);
  const items = tiers.map((tier) => ({
    label: `${tier.tier} attribute${tier.tier === 1 ? "" : "s"} different`,
    count: tier.count,
    meanMs: tier.meanMs,
    stdDevMs: tier.stdDevMs,
  }));
  return <TierBars items={items} />;
}

// A 1x3 grid — one cell per match-count bin (1, 2, 3) — showing just the
// time difference between that attribute being the same vs. different,
// rather than the full same/different bars.
function AttributeDeltaGrid({ finds, attributeIndex, attributeName }) {
  const tiers = useMemo(
    () => computeAttributeEffectBySameCount(finds, attributeIndex),
    [finds, attributeIndex],
  );
  return (
    <Box
      sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1 }}
    >
      {tiers.map((tier) => {
        const hasBoth = tier.same.count > 0 && tier.different.count > 0;
        const deltaMs = hasBoth
          ? tier.same.meanMs - tier.different.meanMs
          : null;
        return (
          <Box
            key={tier.sameCount}
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
              p: 1,
              textAlign: "center",
            }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
            >
              {tier.sameCount} matching
            </Typography>
            {hasBoth ? (
              <>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {deltaMs >= 0 ? "+" : "−"}
                  {formatSeconds(Math.abs(deltaMs))}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                >
                  {deltaMs >= 0
                    ? `${attributeName} same slower`
                    : `${attributeName} same faster`}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                >
                  {formatSeconds(tier.same.meanMs)} vs{" "}
                  {formatSeconds(tier.different.meanMs)}
                </Typography>
              </>
            ) : (
              <Typography variant="caption" color="text.secondary">
                not enough data (n={tier.same.count}/{tier.different.count})
              </Typography>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

function AttributeEffectSection({ finds }) {
  return (
    <Stack spacing={2}>
      {ATTRIBUTE_NAMES.map((name, index) => (
        <Box key={name}>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
            {name}
          </Typography>
          <AttributeDeltaGrid
            finds={finds}
            attributeIndex={index}
            attributeName={name}
          />
        </Box>
      ))}
    </Stack>
  );
}

function BoardSizeSection({ finds }) {
  const tiers = useMemo(() => computeBoardSizeTiers(finds), [finds]);
  const items = tiers.map((tier) => ({
    label: tier.tier === 18 ? "18+ cards" : `${tier.tier} cards`,
    count: tier.count,
    meanMs: tier.meanMs,
    stdDevMs: tier.stdDevMs,
  }));
  return <TierBars items={items} />;
}

function StatsPage({ stats, onBack, onStartStudy }) {
  const { finds, loading, clearAll } = stats;
  const [thresholdSeconds, setThresholdSeconds] = useState(
    DEFAULT_THRESHOLD_SECONDS,
  );
  const [confirmingClear, setConfirmingClear] = useState(false);

  const enoughData = hasEnoughData(finds);
  const histogram = useMemo(
    () => durationHistogram(finds, { maxSeconds: MAX_SLIDER_SECONDS }),
    [finds],
  );
  const percentile = useMemo(
    () => percentileAtThreshold(finds, thresholdSeconds * 1000),
    [finds, thresholdSeconds],
  );
  const pool = useMemo(
    () => selectStudyPool(finds, thresholdSeconds * 1000),
    [finds, thresholdSeconds],
  );

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 3, sm: 5 }, pb: 6 }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 3 }}
      >
        <Typography variant="h4">Normal mode stats</Typography>
        <Button color="inherit" onClick={onBack}>
          Back
        </Button>
      </Stack>

      {loading ? (
        <Typography color="text.secondary">Loading…</Typography>
      ) : !enoughData ? (
        <Box>
          <Typography gutterBottom>
            Play more normal-mode games to unlock stats ({finds.length}/
            {MIN_SAMPLE_SIZE} sets found).
          </Typography>
          <LinearProgress
            variant="determinate"
            value={Math.min(100, (finds.length / MIN_SAMPLE_SIZE) * 100)}
          />
        </Box>
      ) : (
        <Stack spacing={3}>
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              <strong>Speed by how many attributes differ</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Average (mean ± standard deviation) time to find a set, grouped by
              how many of the 4 attributes (color, shape, shade, number) were
              different across the three cards rather than the same.
            </Typography>
            <DifferenceTiersSection finds={finds} />
          </Box>

          <Divider />

          <Box>
            <Typography variant="subtitle1" gutterBottom>
              <strong>
                Does each attribute matter, within each match-count group?
              </strong>
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Controlling for how many attributes matched overall (1, 2, or 3 —
              the 0-match case is skipped since every attribute is trivially
              different there), how much faster or slower is it when this
              specific attribute is the same vs. different?
            </Typography>
            <AttributeEffectSection finds={finds} />
          </Box>

          <Divider />

          <Box>
            <Typography variant="subtitle1" gutterBottom>
              <strong>Speed by board size</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Boards grow past 12 cards when no set exists yet. Average (mean ±
              standard deviation) time to find a set, by how big the board was.
            </Typography>
            <BoardSizeSection finds={finds} />
          </Box>

          <Divider />

          <Box>
            <Typography variant="subtitle1" gutterBottom>
              <strong>Every attribute pattern</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              All 16 same/different combinations across the 4 attributes (S/D
              per color, shape, shade, number), with an example set, average ±
              standard deviation, and a duration histogram for each.
            </Typography>
            <HypercubeGrid finds={finds} />
          </Box>

          <Divider />

          <Box>
            <Typography variant="subtitle1" gutterBottom>
              <strong>Study slow finds</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Drag the slider to choose how slow a find had to be to count as
              "needs study."
            </Typography>
            <DurationHistogram
              histogram={histogram}
              thresholdSeconds={thresholdSeconds}
            />
            <Slider
              value={thresholdSeconds}
              onChange={(_, value) => setThresholdSeconds(value)}
              min={0}
              max={MAX_SLIDER_SECONDS}
              valueLabelDisplay="auto"
              valueLabelFormat={(value) =>
                value >= MAX_SLIDER_SECONDS ? "120s+" : `${value}s`
              }
            />
            <Typography variant="body2" sx={{ mb: 0.25 }}>
              <FixedNumber minWidth="3ch">
                {(percentile * 100).toFixed(0)}%
              </FixedNumber>{" "}
              of your finds are at or above this threshold.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              <FixedNumber minWidth="2ch">{pool.length}</FixedNumber> find
              {pool.length === 1 ? "" : "s"} ready to study.
            </Typography>
            <Button
              variant="contained"
              disabled={pool.length === 0}
              onClick={() => onStartStudy(pool)}
            >
              Start study session
            </Button>
          </Box>
        </Stack>
      )}

      <Divider sx={{ my: 3 }} />
      <Stack direction="row" spacing={2} justifyContent="flex-end">
        <Button
          color={confirmingClear ? "error" : "inherit"}
          onClick={() => {
            if (confirmingClear) {
              clearAll();
              setConfirmingClear(false);
            } else {
              setConfirmingClear(true);
            }
          }}
        >
          {confirmingClear ? "Confirm clear stats" : "Clear stats"}
        </Button>
        <Button variant="contained" onClick={onBack}>
          Back
        </Button>
      </Stack>
    </Container>
  );
}

export default StatsPage;
