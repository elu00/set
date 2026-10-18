import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";

import { prepareOffline } from "../offline";

export default function OfflineStatus() {
  const [status, setStatus] = useState("saving");
  const [storage, setStorage] = useState("default");
  const supported = window.isSecureContext && "serviceWorker" in navigator;

  useEffect(() => {
    if (!import.meta.env.PROD || !supported) return;
    let cancelled = false;
    prepareOffline().then(
      () => {
        if (!cancelled) setStatus("ready");
      },
      () => {
        if (!cancelled) setStatus("error");
      },
    );
    navigator.storage
      ?.persisted?.()
      .then((persisted) => {
        if (!cancelled && persisted) setStorage("persistent");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [supported]);

  async function keepOfflineCopy() {
    setStorage("requesting");
    try {
      const persisted = await navigator.storage.persist();
      setStorage(persisted ? "persistent" : "declined");
    } catch {
      setStorage("declined");
    }
  }

  if (!import.meta.env.PROD) return null;

  let message =
    "Saving for offline use… Keep this page open until it is ready.";
  if (!supported) {
    message =
      "Offline saving requires HTTPS and a browser with offline support.";
  } else if (status === "error") {
    message =
      "Could not save for offline use. Reconnect and reload to try again.";
  } else if (status === "ready") {
    message =
      "Available offline. You can reopen this address after closing your browser.";
    if (storage === "persistent") {
      message += " The browser has agreed to keep the offline copy.";
    } else if (storage === "declined") {
      message +=
        " The browser may clear the copy when it needs storage space.";
    }
  }

  return (
    <div>
      <Typography
        role="status"
        variant="body2"
        color="text.secondary"
        sx={{ mt: 2 }}
      >
        {message}
      </Typography>
      {status === "ready" &&
        navigator.storage?.persist &&
        (storage === "default" || storage === "requesting") && (
          <Button
            size="small"
            onClick={keepOfflineCopy}
            disabled={storage === "requesting"}
          >
            Keep offline copy
          </Button>
        )}
    </div>
  );
}
