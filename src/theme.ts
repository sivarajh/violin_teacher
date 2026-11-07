import { useColorScheme } from 'react-native';

const light = {
  bg: '#faf6f0',
  surface: '#ffffff',
  text: '#2b211a',
  muted: '#7a6a5c',
  border: '#e7ddd0',
  accent: '#a0522d',
  accentInk: '#ffffff',
  accentSoft: '#f6e6da',
  good: '#2e8b57',
  near: '#d4a017',
  far: '#c0392b',
  wood: '#3a2618',
  board: '#5a3a24',
  woodInk: '#f6e9dc',
};

const dark: typeof light = {
  bg: '#1b1612',
  surface: '#26201b',
  text: '#f2e9df',
  muted: '#b3a291',
  border: '#3b322a',
  accent: '#e08a5a',
  accentInk: '#1b1612',
  accentSoft: '#3a2a20',
  good: '#3fb57a',
  near: '#e0b030',
  far: '#e05a4a',
  wood: '#120c08',
  board: '#3a2618',
  woodInk: '#f6e9dc',
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}
