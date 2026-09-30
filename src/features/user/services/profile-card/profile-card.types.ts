import type { DayActivity } from './activity-chart';

export interface ProfileCardData {
  themeId?: string;
  pseudo: string;
  bio: string;
  ridgecoin: string;
  level: string;
  messages: string;
  voc: string;
  birthday: string;
  joinedAt: string;
  avatarUrl: string;
  roles: { name: string; color: string }[];
  weeklyActivity: DayActivity[];
  mountains: { name: string; unlocked: boolean }[];
  xp: { current: number; required: number; percent: number };
}
