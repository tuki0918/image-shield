export interface EncryptOptions {
  output: string;
  key?: string;
  blockSize?: number;
  prefix?: string;
  seed?: number;
  restoreFilename?: boolean;
}

export interface DecryptOptions {
  manifest: string;
  output: string;
  key?: string;
}
