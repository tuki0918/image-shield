export interface ShuffleOptions {
  output: string;
  blockSize?: number;
  prefix?: string;
  seed?: number;
  preserveName?: boolean;
  perImageShuffle?: boolean;
}

export interface RestoreOptions {
  manifest: string;
  output: string;
}
