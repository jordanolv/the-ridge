import { useState } from 'react';
import { brandUrl } from '../lib/api';

export function Logo({ size = 36 }: { size?: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="text-gradient text-xl font-black">R</span>;
  return <img src={brandUrl('logo')} alt="The Ridge" style={{ height: size }} onError={() => setFailed(true)} className="w-auto drop-shadow-[0_0_12px_rgba(167,139,250,0.45)]" />;
}
