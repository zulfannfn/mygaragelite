import React, { createContext, ReactNode, useContext } from 'react';
import { darkTheme, lightTheme } from '../constants/theme';

interface ThemeValue {
  theme: any;
  isDarkMode: boolean;
}

const ThemeContext = createContext<ThemeValue>({
  theme: darkTheme,
  isDarkMode: true,
});

export function ThemeProvider({ children, isDarkMode }: { children: ReactNode; isDarkMode: boolean }) {
  const theme = isDarkMode ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ theme, isDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export type ThemeContextType = ReturnType<typeof useTheme>;
