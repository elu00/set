import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useMemo } from "react";

import { computeSetCoverage } from "../setCoverage";

export default function SetCoverageStats({
  coverage,
  gameMode = "normal",
  loading,
  error,
}) {
  const { found, appeared, total } = useMemo(
    () => computeSetCoverage(coverage, gameMode),
    [coverage, gameMode],
  );
  const label = gameMode === "ultraset" ? "UltraSets" : "sets";

  return (
    <Box>
      <Typography variant="subtitle1">
        <strong>Lifetime {label}</strong>
      </Typography>
      {loading ? (
        <Typography variant="body2" color="text.secondary">
          Loading…
        </Typography>
      ) : (
        <>
          {[
            ["Unique found", found],
            ["Unique appeared", appeared],
          ].map(([name, count]) => (
            <Box
              key={name}
              sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}
            >
              <Typography variant="body2">{name}</Typography>
              <Typography
                variant="body2"
                sx={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}
              >
                <strong>
                  {count.toLocaleString()} / {total.toLocaleString()}
                </strong>
              </Typography>
            </Box>
          ))}
          <Typography variant="caption" color="text.secondary">
            Across all games. Each distinct combination counts once. Appeared
            means its cards were available together as a valid set.
            {gameMode === "setjr" && " Only Junior combinations are shown."}
          </Typography>
        </>
      )}
      {error && (
        <Typography
          variant="caption"
          color="error"
          display="block"
          role="status"
        >
          Some statistics could not be saved or loaded in this browser.
        </Typography>
      )}
    </Box>
  );
}
