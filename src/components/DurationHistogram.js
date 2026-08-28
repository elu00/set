import Box from "@mui/material/Box";

function DurationHistogram({ histogram, thresholdSeconds, height = 48 }) {
  const max = Math.max(1, ...histogram.map((bucket) => bucket.count));
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-end",
        height,
        gap: "1px",
        width: "100%",
      }}
    >
      {histogram.map((bucket) => (
        <Box
          key={bucket.bucketStartSec}
          title={`${bucket.bucketStartSec}–${bucket.bucketEndSec}s: ${bucket.count}`}
          sx={{
            flexGrow: 1,
            height: `${(bucket.count / max) * 100}%`,
            minHeight: bucket.count > 0 ? 2 : 0,
            bgcolor:
              thresholdSeconds !== undefined &&
              bucket.bucketStartSec >= thresholdSeconds
                ? "secondary.main"
                : "action.disabled",
          }}
        />
      ))}
    </Box>
  );
}

export default DurationHistogram;
