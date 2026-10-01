import { UserMountainsRepository } from '../../../../peak-hunters/repositories/user-mountains.repository';
import { MountainService } from '../../../../peak-hunters/services/mountain.service';
import { activityChart } from '../components/activity-chart';
import { card } from '../components/card';
import { panel } from '../components/panel';
import { profileHeader } from '../components/profile-header';
import { progressBar } from '../components/progress-bar';
import { roleBadges } from '../components/role-badges';
import { statCard } from '../components/stat-card';
import { iconSrc, type IconName } from '../engine/assets';
import { fetchAvatar } from '../engine/avatar';
import { box, image } from '../engine/elements';
import { formatDate, formatDuration, formatNumber } from '../engine/format';
import { rect } from '../engine/geometry';
import { dailyTotals, type DailyTotal } from '../engine/series';
import { xpProgress } from '../../xp-progress';
import { defineTab } from './tab';

const STAT_ROWS = [381, 512, 643, 773];
const STAT_HEIGHT = 104;
const PANEL_PADDING = 37;

const PANELS = {
  overview: rect(28, 28, 888, 332),
  activity: rect(28, 381, 888, 496),
  profile: rect(946, 28, 530, 332),
  ridgecoin: rect(946, STAT_ROWS[0], 240, STAT_HEIGHT),
  level: rect(946, STAT_ROWS[1], 240, STAT_HEIGHT),
  messages: rect(946, STAT_ROWS[2], 240, STAT_HEIGHT),
  voice: rect(946, STAT_ROWS[3], 240, STAT_HEIGHT),
  birthday: rect(1216, STAT_ROWS[0], 260, STAT_HEIGHT),
  joined: rect(1216, STAT_ROWS[1], 260, STAT_HEIGHT),
  logo: rect(1216, STAT_ROWS[2], 260, STAT_ROWS[3] + STAT_HEIGHT - STAT_ROWS[2]),
};

const LAYOUT = { id: 'profil', panels: Object.values(PANELS) };

export interface ProfileData {
  pseudo: string;
  bio: string;
  avatar: Buffer;
  ridgecoin: string;
  level: string;
  messages: string;
  voice: string;
  birthday: string;
  joinedAt: string;
  roles: { name: string; color: string }[];
  voiceFortnight: DailyTotal[];
  mountains: { unlocked: number; total: number };
  xp: { current: number; required: number; percent: number };
}

const STATS: { panel: keyof typeof PANELS; icon: IconName; label: string; value: (d: ProfileData) => string; size: number }[] = [
  { panel: 'ridgecoin', icon: 'ridgecoin', label: 'RidgeCoin', value: d => d.ridgecoin, size: 32 },
  { panel: 'level', icon: 'level', label: 'Niveaux', value: d => d.level, size: 32 },
  { panel: 'messages', icon: 'messages', label: 'Messages', value: d => d.messages, size: 32 },
  { panel: 'voice', icon: 'voice', label: 'Temps Voc', value: d => d.voice, size: 32 },
  { panel: 'birthday', icon: 'birthday', label: 'Anniversaire', value: d => d.birthday, size: 26 },
  { panel: 'joined', icon: 'joined', label: 'Ici depuis', value: d => d.joinedAt, size: 26 },
];

export const profileTab = defineTab<ProfileData>({
  id: 'profil',
  label: 'Profil',
  emoji: '👤',
  layout: LAYOUT,

  async load({ user, member, account }) {
    const [avatar, mountains] = await Promise.all([
      fetchAvatar(user.displayAvatarURL({ size: 256, extension: 'png' })),
      UserMountainsRepository.getByUserId(user.id),
    ]);
    const level = account.profil?.lvl ?? 0;
    const roles = member
      ? [...member.roles.cache.values()]
          .filter(role => role.id !== member.guild.id)
          .sort((a, b) => b.position - a.position)
          .map(role => ({ name: role.name, color: role.hexColor }))
      : [];

    return {
      pseudo: user.username,
      bio: account.bio?.trim() || 'Aucune bio définie.',
      avatar,
      ridgecoin: formatNumber(account.profil?.money ?? 0),
      level: String(level),
      messages: formatNumber(account.stats?.totalMsg ?? 0),
      voice: formatDuration(account.stats?.voiceTime ?? 0),
      birthday: formatDate(account.infos?.birthDate),
      joinedAt: formatDate(account.infos?.registeredAt),
      roles,
      voiceFortnight: dailyTotals((account.stats?.voiceHistory ?? []).map(v => ({ date: v.date, amount: v.time })), 14),
      mountains: { unlocked: mountains?.unlockedMountains.length ?? 0, total: MountainService.count },
      xp: xpProgress(level, account.profil?.exp ?? 0),
    };
  },

  build(data, theme) {
    const { style } = theme;
    const { unlocked, total } = data.mountains;
    const mountainRatio = total > 0 ? unlocked / total : 0;

    return card(
      theme,
      LAYOUT,
      panel(
        PANELS.overview,
        style,
        { flexDirection: 'column', padding: `18px ${PANEL_PADDING}px 26px` },
        roleBadges(data.roles, PANELS.overview.width - PANEL_PADDING * 2, 180),
        box(
          { gap: 48, marginTop: 'auto', padding: '0 24px' },
          progressBar('Niveau', data.level, data.xp.percent, `${formatNumber(data.xp.current)} / ${formatNumber(data.xp.required)} XP`, 'linear-gradient(90deg, #f7971e, #ffd200)'),
          progressBar('Montagnes', `${unlocked} / ${total}`, mountainRatio, `${Math.round(mountainRatio * 100)}%`, 'linear-gradient(90deg, #36E0BE, #4facfe)'),
        ),
      ),
      panel(
        PANELS.activity,
        style,
        { padding: `0 ${PANEL_PADDING}px` },
        activityChart(data.voiceFortnight, PANELS.activity.width - PANEL_PADDING * 2, PANELS.activity.height, style.accent),
        image(iconSrc('chart'), { position: 'absolute', right: 70, top: 26, width: 44, height: 44 }),
      ),
      panel(PANELS.profile, style, { justifyContent: 'center', paddingTop: 16 }, profileHeader(data.avatar, data.pseudo, data.bio, PANELS.profile.width - 50)),
      ...STATS.map(stat => statCard(PANELS[stat.panel], style, stat.icon, stat.label, stat.value(data), stat.size)),
      panel(PANELS.logo, style, { alignItems: 'center', justifyContent: 'center' }, image(iconSrc('logo'), { width: 162, height: 168 })),
    );
  },
});
