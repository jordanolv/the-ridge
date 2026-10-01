import { box, image, text, type CardNode } from '../engine/elements';
import { truncateToWidth } from '../engine/text';

export interface ThumbnailProps {
  photo: Buffer | null;
  label: string;
  caption: string;
  color: string;
  hidden?: boolean;
}

/** Vignette photo à liseré de rareté ; `hidden` la floute pour une montagne pas encore trouvée. */
export function thumbnail({ photo, label, caption, color, hidden = false }: ThumbnailProps, width: number, height: number): CardNode {
  return box(
    {
      position: 'relative',
      width,
      height,
      borderRadius: 10,
      overflow: 'hidden',
      border: `2px solid ${color}`,
      backgroundColor: 'rgba(0,0,0,0.35)',
    },
    photo !== null &&
      image(photo, {
        position: 'absolute',
        left: 0,
        top: 0,
        width,
        height,
        objectFit: 'cover',
        ...(hidden ? { filter: 'blur(10px) grayscale(0.7) brightness(0.7)' } : {}),
      }),
    box(
      {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        flexDirection: 'column',
        padding: '22px 10px 8px',
        backgroundImage: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.8) 100%)',
      },
      text({ fontSize: 16, fontWeight: 700, color: 'white', whiteSpace: 'nowrap' }, hidden ? '???' : truncateToWidth(label, width - 20, 16, 700)),
      text({ fontSize: 13, color, whiteSpace: 'nowrap' }, caption),
    ),
  );
}
