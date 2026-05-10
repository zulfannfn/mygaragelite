import { useCallback, useEffect, useState } from 'react';
import { reportService } from '../services/reportService';
import { DashboardStats } from '../types';

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const s = await reportService.getDashboardStats();
    setStats(s);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { stats, loading, refresh };
}
