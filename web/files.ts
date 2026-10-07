import { cxx } from './cxx';

// Sample files for web/RoundTripModule.ts, in the WebAssembly module's file
// system (web/cxx.ts), where the C++ module reads and writes too.

export function writeFile(path: string, bytes: Uint8Array) {
  cxx().FS.writeFile(path, bytes);
}

// Returns null when the file doesn't exist.
export function readFile(path: string): Uint8Array | null {
  const { FS } = cxx();
  return FS.analyzePath(path, false).exists ? FS.readFile(path) : null;
}

// Returns false when the file doesn't exist.
export function removeFile(path: string): boolean {
  const { FS } = cxx();
  if (!FS.analyzePath(path, false).exists) {
    return false;
  }
  FS.unlink(path);
  return true;
}
