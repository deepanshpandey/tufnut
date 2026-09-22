// Global type declarations for assets that webpack handles at build time
// but TypeScript needs to know about.

declare module "*.css" {
  const styles: Record<string, string>;
  export default styles;
}

declare module "*.png" {
  const src: string;
  export default src;
}

declare module "*.svg" {
  const src: string;
  export default src;
}
