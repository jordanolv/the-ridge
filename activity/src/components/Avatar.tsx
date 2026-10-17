import { useState } from 'react';
import { avatarUrl } from '../lib/api';

interface AvatarProps {
  userId: string;
  name: string;
  size?: number;
}

export function Avatar({ userId, name, size = 40 }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size };

  if (failed) {
    return (
      <div style={style} className="grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-glow-violet to-glow-cyan font-bold text-night-950">
        {name.charAt(0).toUpperCase()}
      </div>
    );
  }

  return <img src={avatarUrl(userId)} alt="" style={style} onError={() => setFailed(true)} className="shrink-0 rounded-full object-cover ring-2 ring-white/15" />;
}
