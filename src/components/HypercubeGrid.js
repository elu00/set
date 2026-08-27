import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useMemo } from "react";

import { formatSeconds } from "../formatTime";
import useDimensions from "../hooks/useDimensions";
import {
  ATTRIBUTE_NAMES,
  HYPERCUBE_MIN_SAMPLES,
  computeHypercubeCellStats,
  durationHistogram,
  exampleSetForPattern,
  hypercubePatterns,
  selectFindsByPattern,
} from "../statsLogic";
import DurationHistogram from "./DurationHistogram";
import ResponsiveSetCard from "./ResponsiveSetCard";

const CARD_GAP = 4;

// Sizes the 3 example cards, measured live, to fill the width of whatever
// box they're placed in — mirrors how Game.js derives cardWidth from its
// measured container width, just scaled down to a grid-cell context.
function ExampleSet({ cards }) {
  const [dimensions, ref] = useDimensions();
  const width = dimensions
    ? Math.max(
        18,
        Math.floor(
          (dimensions.width - CARD_GAP * (cards.length - 1)) / cards.length,
        ),
      )
    : 24;
  return (
    <Box
      ref={ref}
      sx={{ display: "flex", justifyContent: "center", gap: `${CARD_GAP}px` }}
    >
      {cards.map((card, index) => (
        <ResponsiveSetCard
          key={`${card}-${index}`}
          value={card}
          width={width}
        />
      ))}
    </Box>
  );
}

// Compact S/D code, one letter per attribute in ATTRIBUTE_NAMES order
// (Color, Shape, Shade, Number) — e.g. "SDSS" = same color, different
// shape, same shade, same number.
function patternCode(sameAttrs) {
  return sameAttrs.map((same) => (same ? "S" : "D")).join("");
}

function patternLabel(sameAttrs) {
  return ATTRIBUTE_NAMES.map(
    (name, index) => `${name}: ${sameAttrs[index] ? "same" : "different"}`,
  ).join(", ");
}

function HypercubeCell({ pattern, finds }) {
  const example = useMemo(
    () => exampleSetForPattern(pattern.sameAttrs),
    [pattern.sameAttrs],
  );
  const stats = useMemo(
    () => computeHypercubeCellStats(finds, pattern.sameAttrs),
    [finds, pattern.sameAttrs],
  );
  const enough = stats.count >= HYPERCUBE_MIN_SAMPLES;
  const histogram = useMemo(() => {
    if (!enough) return [];
    return durationHistogram(selectFindsByPattern(finds, pattern.sameAttrs), {
      maxSeconds: 60,
      bucketSeconds: 10,
    });
  }, [finds, pattern.sameAttrs, enough]);

  return (
    <Box
      title={`${patternCode(pattern.sameAttrs)} — ${patternLabel(pattern.sameAttrs)}`}
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        p: 0.75,
        textAlign: "center",
      }}
    >
      <Typography variant="caption" color="text.secondary" display="block">
        {patternCode(pattern.sameAttrs)}
      </Typography>
      <ExampleSet cards={example} />
      {enough ? (
        <>
          <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
            {formatSeconds(stats.meanMs)} ± {formatSeconds(stats.stdDevMs)}
          </Typography>
          <Typography variant="caption" display="block" color="text.secondary">
            n={stats.count}
          </Typography>
          <DurationHistogram histogram={histogram} height={24} />
        </>
      ) : (
        <Typography
          variant="caption"
          display="block"
          color="text.secondary"
          sx={{ mt: 0.5 }}
        >
          n={stats.count}
        </Typography>
      )}
    </Box>
  );
}

function HypercubeGrid({ finds }) {
  const patterns = useMemo(() => hypercubePatterns(), []);

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 0.75,
      }}
    >
      {patterns.map((pattern) => (
        <HypercubeCell
          key={pattern.sameAttrs.join("")}
          pattern={pattern}
          finds={finds}
        />
      ))}
    </Box>
  );
}

export default HypercubeGrid;
