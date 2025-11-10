export interface ShuffleOptions {
  output: string;
  blockSize?: number;
  prefix?: string;
  seed?: number;
  preserveName?: boolean;
  crossImageShuffle?: boolean;
}

export interface RestoreOptions {
  manifest: string;
  output: string;
}
