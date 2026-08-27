export function formatTime(milliseconds, hideSubsecond = true) {
  const elapsed = Math.max(0, milliseconds);
  const hours = Math.floor(elapsed / (3600 * 1000));
  const rest = elapsed % (3600 * 1000);
  const minutes = Math.floor(rest / 60000);
  const seconds = Math.floor((rest % 60000) / 1000);
  const hundredths = Math.floor((rest % 1000) / 10);
  const clock = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  const subsecond = hideSubsecond
    ? ""
    : `.${String(hundredths).padStart(2, "0")}`;
  return `${hours ? `${hours}:` : ""}${clock}${subsecond}`;
}

function roundToSigFigs(value, sigFigs) {
  if (value === 0) return 0;
  const magnitude = Math.floor(Math.log10(Math.abs(value)));
  const factor = 10 ** (sigFigs - 1 - magnitude);
  return Math.round(value * factor) / factor;
}

// Formats a duration compactly as seconds, rounded to a fixed number of
// significant figures (e.g. 780ms -> "0.78s", 13400ms -> "13s").
export function formatSeconds(milliseconds, sigFigs = 2) {
  if (milliseconds === null) return "—";
  return `${roundToSigFigs(milliseconds / 1000, sigFigs)}s`;
}
