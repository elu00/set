import { useCallback, useEffect, useState } from "react";

import { attributeSameness } from "../gameLogic";
import {
  addFind,
  clearFinds,
  getAllFinds,
  updateFindStudyState,
} from "../statsDb";

function useNormalModeStats() {
  const [finds, setFinds] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getAllFinds()
      .then((loaded) => {
        if (!cancelled) setFinds(loaded);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err);
          setFinds([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const recordFind = useCallback((payload) => {
    const record = {
      ...payload,
      sameAttrs: attributeSameness(...payload.cards),
      studyState: "unreviewed",
    };
    addFind(record)
      .then((id) => {
        setFinds((value) => [...(value || []), { ...record, id }]);
      })
      .catch((err) => {
        // IndexedDB unavailable (e.g. private browsing): keep the find
        // visible for this session via a synthetic id, even though it
        // can't be persisted or later re-graded across reloads.
        setError(err);
        setFinds((value) => [
          ...(value || []),
          { ...record, id: -Date.now() - Math.random() },
        ]);
      });
  }, []);

  const markStudyState = useCallback((id, studyState) => {
    setFinds((value) =>
      (value || []).map((find) =>
        find.id === id ? { ...find, studyState } : find,
      ),
    );
    updateFindStudyState(id, studyState).catch((err) => setError(err));
  }, []);

  const clearAll = useCallback(() => {
    setFinds([]);
    clearFinds().catch((err) => setError(err));
  }, []);

  return {
    finds: finds || [],
    loading,
    error,
    recordFind,
    markStudyState,
    clearAll,
  };
}

export default useNormalModeStats;
