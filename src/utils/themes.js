import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';

// Custom app-specific colors
const appColors = {
  light: {
    // Status colors
    success: '#4CAF50',
    warning: '#FF9800', 
    info: '#2196F3',
    // Attendance status colors
    present: '#4CAF50',
    halfDay: '#FF9800',
    absent: '#F44336',
    // Custom surfaces
    cardBackground: '#FFFFFF',
    screenBackground: '#F8F9FA',
    headerBackground: '#FFFFFF',
    listItemBackground: '#FFFFFF',
    borderColor: '#E0E0E0',
    // Balance colors
    positiveBalance: '#4CAF50',
    negativeBalance: '#F44336',
    zeroBalance: '#757575',
  },
  dark: {
    // Status colors (lighter variants for dark mode)
    success: '#81C784',
    warning: '#FFB74D',
    info: '#64B5F6', 
    // Attendance status colors (softer for dark mode)
    present: '#81C784',
    halfDay: '#FFB74D',
    absent: '#E57373',
    // Custom surfaces
    cardBackground: '#1E1E1E',
    screenBackground: '#121212',
    headerBackground: '#1F1F1F',
    listItemBackground: '#2A2A2A',
    borderColor: '#404040',
    // Balance colors (softer for dark mode)
    positiveBalance: '#81C784',
    negativeBalance: '#E57373',
    zeroBalance: '#BDBDBD',
  }
};

export const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    ...appColors.light,
    // Override Paper defaults for better consistency
    background: appColors.light.screenBackground,
    surface: appColors.light.cardBackground,
  }
};

export const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    ...appColors.dark,
    // Override Paper defaults for better consistency
    background: appColors.dark.screenBackground,
    surface: appColors.dark.cardBackground,
  }
};

// Export theme getter function
export const getTheme = (isDark) => isDark ? darkTheme : lightTheme;
