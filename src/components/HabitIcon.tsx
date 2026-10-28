import React from 'react';
import {
  BookOpen,
  Coffee,
  Droplets,
  Dumbbell,
  Footprints,
  Heart,
  Moon,
  Repeat,
  type LucideIcon,
} from 'lucide-react';

export const HABIT_ICON_IDS = [
  'Repeat',
  'BookOpen',
  'Dumbbell',
  'Droplets',
  'Moon',
  'Footprints',
  'Heart',
  'Coffee',
] as const;

export type HabitIconId = (typeof HABIT_ICON_IDS)[number];

const ICONS: Record<HabitIconId, LucideIcon> = {
  Repeat,
  BookOpen,
  Dumbbell,
  Droplets,
  Moon,
  Footprints,
  Heart,
  Coffee,
};

export function habitIcon(name?: string): LucideIcon {
  if (name && name in ICONS) return ICONS[name as HabitIconId];
  return Repeat;
}

export const HabitIcon: React.FC<{ name?: string; className?: string }> = ({ name, className }) => {
  const Icon = habitIcon(name);
  return <Icon className={className} />;
};
