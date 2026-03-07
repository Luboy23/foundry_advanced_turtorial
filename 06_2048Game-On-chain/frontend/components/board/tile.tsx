"use client";

import type { Tile as TileModel } from "@/models/tile";

type TileProps = {
  tile: TileModel;
};

const TILE_STYLES: Record<number, { background: string; color: string }> = {
  2: { background: "#eee4da", color: "#776e65" },
  4: { background: "#ede0c8", color: "#776e65" },
  8: { background: "#f2b179", color: "#f9f6f2" },
  16: { background: "#f59563", color: "#f9f6f2" },
  32: { background: "#f67c5f", color: "#f9f6f2" },
  64: { background: "#f65e3b", color: "#f9f6f2" },
  128: { background: "#edcf72", color: "#f9f6f2" },
  256: { background: "#edcc61", color: "#f9f6f2" },
  512: { background: "#edc850", color: "#f9f6f2" },
  1024: { background: "#edc53f", color: "#f9f6f2" },
  2048: { background: "#edc22e", color: "#f9f6f2" },
};

export default function Tile({ tile }: TileProps) {
  const style = TILE_STYLES[tile.value] ?? {
    background: "#3c3a32",
    color: "#f9f6f2",
  };

  return (
    <div
      className="flex h-full w-full items-center justify-center rounded font-bold text-2xl md:text-4xl"
      style={{ background: style.background, color: style.color }}
    >
      {tile.value}
    </div>
  );
}
