import fs from 'node:fs';
import path from 'node:path';
import { imageGenConfig } from './visualConfig';

// Local-disk storage for prototype/dev. Production swaps this module's body for an
// S3/R2 client behind the SAME interface (put / pathFor / read / exists); callers
// only ever hold storage KEYS, never binaries. NOTE: Railway's filesystem is
// ephemeral, so local storage is dev-only — object storage is required for prod.
export const visualStorage = {
  async put(key: string, bytes: Buffer): Promise<void> {
    const file = path.join(imageGenConfig.storageDir, key);
    await fs.promises.mkdir(path.dirname(file), { recursive: true });
    await fs.promises.writeFile(file, bytes);
  },
  pathFor(key: string): string {
    return path.join(imageGenConfig.storageDir, key);
  },
  exists(key: string): boolean {
    return fs.existsSync(path.join(imageGenConfig.storageDir, key));
  },
};
