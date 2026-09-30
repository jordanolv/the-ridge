import { activityChart } from './activity-chart';
import { panel, profileHeader, progressBar, roleBadges, statCard, icon } from './components';
import { box, image, type CardNode } from './elements';
import { FONT_FAMILY } from './fonts';
import { CARD_HEIGHT, CARD_WIDTH, PANELS, type PanelName } from './geometry';
import type { ProfileCardData } from './profile-card.types';
import type { ProfileTheme } from './themes';

const STATS: { panel: PanelName; icon: string; label: string; value: (d: ProfileCardData) => string; size: number }[] = [
  { panel: 'ridgecoin', icon: 'ridgecoin', label: 'RidgeCoin', value: d => d.ridgecoin, size: 32 },
  { panel: 'level', icon: 'level', label: 'Niveaux', value: d => d.level, size: 32 },
  { panel: 'messages', icon: 'messages', label: 'Messages', value: d => d.messages, size: 32 },
  { panel: 'voice', icon: 'voice', label: 'Temps Voc', value: d => d.voc, size: 32 },
  { panel: 'birthday', icon: 'birthday', label: 'Anniversaire', value: d => d.birthday, size: 26 },
  { panel: 'joined', icon: 'joined', label: 'Ici depuis', value: d => d.joinedAt, size: 26 },
];

const OVERVIEW_PADDING = 37;
const ACTIVITY_PADDING = 37;

export function buildCard(data: ProfileCardData, theme: ProfileTheme, background: string, avatar: string): CardNode {
  const { style } = theme;
  const unlocked = data.mountains.filter(m => m.unlocked).length;
  const mountainRatio = data.mountains.length > 0 ? unlocked / data.mountains.length : 0;
  const overviewWidth = PANELS.overview.width - OVERVIEW_PADDING * 2;
  const activityWidth = PANELS.activity.width - ACTIVITY_PADDING * 2;

  return box(
    { position: 'relative', width: CARD_WIDTH, height: CARD_HEIGHT, fontFamily: FONT_FAMILY },
    image(background, { position: 'absolute', left: 0, top: 0, width: CARD_WIDTH, height: CARD_HEIGHT }),

    panel(
      PANELS.overview,
      style,
      { flexDirection: 'column', padding: `18px ${OVERVIEW_PADDING}px 26px` },
      roleBadges(data.roles, overviewWidth, 180),
      box(
        { gap: 48, marginTop: 'auto', padding: '0 24px' },
        progressBar('Niveau', data.level, data.xp.percent, `${data.xp.current.toLocaleString('fr-FR')} / ${data.xp.required.toLocaleString('fr-FR')} XP`, 'linear-gradient(90deg, #f7971e, #ffd200)'),
        progressBar('Montagnes', `${unlocked} / ${data.mountains.length}`, mountainRatio, `${Math.round(mountainRatio * 100)}%`, 'linear-gradient(90deg, #36E0BE, #4facfe)'),
      ),
    ),

    panel(
      PANELS.activity,
      style,
      { padding: `0 ${ACTIVITY_PADDING}px` },
      activityChart(data.weeklyActivity, activityWidth, PANELS.activity.height, style.accent),
      image(icon('chart'), { position: 'absolute', right: 70, top: 26, width: 44, height: 44 }),
    ),

    panel(
      PANELS.profile,
      style,
      { justifyContent: 'center', paddingTop: 16 },
      profileHeader(avatar, data.pseudo, data.bio, PANELS.profile.width - 50),
    ),

    ...STATS.map(stat => statCard(PANELS[stat.panel], style, stat.icon, stat.label, stat.value(data), stat.size)),

    panel(PANELS.logo, style, { alignItems: 'center', justifyContent: 'center' }, image(icon('logo'), { width: 162, height: 168 })),
  );
}
