export interface ShuffleOptions {
  output: string;
  blockSize?: number;
  prefix?: string;
  seed?: number;
  restoreFilename?: boolean;
}

export interface RestoreOptions {
  manifest: string;
  output: string;
}
