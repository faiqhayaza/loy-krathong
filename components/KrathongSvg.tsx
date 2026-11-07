// A hand-drawn krathong as inline SVG: a banana-leaf boat in the chosen
// colours, the chosen flower, and a candle flame that flickers (CSS).
//
// The artwork itself lives in lib/krathongArt — the same markup the
// river canvas draws — so the builder preview and the boats on the
// river can never drift apart again.

import { krathongInnerMarkup } from '@/lib/krathongArt';

interface Props {
  boat: string;
  flower: string;
  flame: string;
  name?: string;
  width?: number;
}

export default function KrathongSvg({ boat, flower, flame, name, width = 220 }: Props) {
  const label = name?.trim() ? name.trim() : '';

  return (
    <svg
      width={width}
      height={width * 0.62}
      viewBox="0 0 220 136"
      role="img"
      aria-label={label ? `Krathong for ${label}` : 'Krathong preview'}
      dangerouslySetInnerHTML={{ __html: krathongInnerMarkup(boat, flower, flame) }}
    />
  );
}
