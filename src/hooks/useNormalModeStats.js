import { useCallback, useEffect, useState } from "react";

import { attributeSameness } from "../gameLogic";
import { capMoveDuration } from "../gameTiming";
import { coverageEntry, mergeCoverage } from "../setCoverage";
import {
  addFind,
  clearStats,
  getAllFinds,
  getSetCoverage,
  saveSetCoverage,
  updateFindStudyState,
} from "../statsDb";

function useNormalModeStats() {
  const [finds, setFinds] = useState(null);
  const [coverage, setCoverage] = useState(() => new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getAllFinds(), getSetCoverage()])
      .then(([loaded, savedCoverage]) => {
        if (!cancelled) {
          setFinds(loaded);
          setCoverage((value) => mergeCoverage(value, savedCoverage));
        }
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

  const recordSets = useCallback((sets, found = false) => {
    if (sets.length === 0) return;
    const entries = sets.map((cards) => coverageEntry(cards, found));
    setCoverage((value) => mergeCoverage(value, entries));
    saveSetCoverage(entries).catch((err) => setError(err));
  }, []);

  const recordFind = useCallback((payload) => {
    const record = {
      ...payload,
      durationMs: capMoveDuration(payload.durationMs),
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
    setCoverage(new Map());
    clearStats().catch((err) => setError(err));
  }, []);

  return {
    finds: finds || [],
    coverage,
    loading,
    error,
    recordFind,
    recordSets,
    markStudyState,
    clearAll,
  };
}

export default useNormalModeStats;
