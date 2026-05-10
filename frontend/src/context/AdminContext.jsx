import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';

const AdminContext = createContext(null);

export const useAdmin = () => {
  const ctx = useContext(AdminContext);
  if (!ctx) {
    throw new Error('useAdmin must be used within AdminProvider');
  }
  return ctx;
};

export const AdminProvider = ({ children }) => {
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(null);

  const refreshStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const { data } = await api.get('/admin/stats');
      setStats(data);
    } catch (e) {
      setStatsError(e.response?.data?.message || 'Не удалось загрузить статистику');
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  const value = useMemo(
    () => ({
      stats,
      statsLoading,
      statsError,
      refreshStats,
    }),
    [stats, statsLoading, statsError, refreshStats]
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
};
