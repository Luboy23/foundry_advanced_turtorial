"use client";

export type MintImageItem = {
  id: string;
  name: string;
  preview: string;
  blob: Blob;
  meta: string;
  customName?: string;
  customSymbol?: string;
  imageUrl?: string;
  imagePath?: string;
};
