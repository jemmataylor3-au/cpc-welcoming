"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Visitor, VisitorStatus } from "@/types/database";

export type SortOrder = "newest" | "oldest";

const SORT_PREFERENCE_KEY = "cpc-welcoming-sort-order";

function getStoredSortOrder(): SortOrder {
  if (typeof window === "undefined") return "newest";
  const stored = window.localStorage.getItem(SORT_PREFERENCE_KEY);
  return stored === "oldest" ? "oldest" : "newest";
}

function storeSortOrder(order: SortOrder) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SORT_PREFERENCE_KEY, order);
}

export function useVisitors(status: VisitorStatus) {
  const supabase = createClient();
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Sort preference is shared across Active/Settled/Archived and persists
  // in the browser (per-device, not per-account) via localStorage.
  const [sortOrder, setSortOrderState] = useState<SortOrder>("newest");

  useEffect(() => {
    setSortOrderState(getStoredSortOrder());
  }, []);

  const setSortOrder = useCallback((order: SortOrder) => {
    setSortOrderState(order);
    storeSortOrder(order);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from("visitors")
      .select("*")
      .eq("status", status)
      .order("date_first_attended", { ascending: sortOrder === "oldest" });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setVisitors((data as Visitor[]) ?? []);
    }
    setLoading(false);
  }, [supabase, status, sortOrder]);

  useEffect(() => {
    load();
  }, [load]);

  return { visitors, loading, error, refresh: load, sortOrder, setSortOrder };
}
