'use client';

import React, { useEffect } from 'react';
import { Provider } from 'react-redux';
import { store, useAppDispatch, useAppSelector } from '../store';
import { hydrateSession } from '../store/slices/authSlice';

const ThemeAndSessionSync: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dispatch = useAppDispatch();
  const theme = useAppSelector((s) => s.ui.theme);
  const hydrated = useAppSelector((s) => s.auth.hydrated);

  useEffect(() => {
    if (!hydrated) {
      dispatch(hydrateSession());
    }
  }, [dispatch, hydrated]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  return <>{children}</>;
};

export const Providers: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <Provider store={store}>
      <ThemeAndSessionSync>{children}</ThemeAndSessionSync>
    </Provider>
  );
};
