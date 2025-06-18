import { version } from "../package.json";

export const VERSION = version;
export const MANIFEST_FILE_NAME = "manifest.json";

export const DEFAULT_FRAGMENTATION_CONFIG = {
  BLOCK_SIZE: 1,
  PREFIX: "img",
  RESTORE_FILE_NAME: false,
};
