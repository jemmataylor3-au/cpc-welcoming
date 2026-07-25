"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Visitor, VisitorStatus } from "@/types/database";

export function useVisitors(status: VisitorStatus) {
  const supabase = createClient();
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from("visitors")
      .select("*")
      .eq("status", status)
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setVisitors((data as Visitor[]) ?? []);
    }
    setLoading(false);
  }, [supabase, status]);

  useEffect(() => {
    load();
  }, [load]);

  return { visitors, loading, error, refresh: load };
}
