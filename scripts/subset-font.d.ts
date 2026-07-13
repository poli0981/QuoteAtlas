declare module 'subset-font' {
  interface SubsetFontOptions {
    targetFormat?: 'sfnt' | 'woff' | 'woff2';
    preserveNameIds?: number[];
    variationAxes?: Record<string, { min?: number; max?: number; default?: number }>;
  }
  export default function subsetFont(
    font: Uint8Array,
    text: string,
    options?: SubsetFontOptions,
  ): Promise<Buffer>;
}
