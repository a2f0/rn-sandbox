import { cxx, removeStamped, writeStamped } from './cxx';

// Sample files for web/RoundTripModule.ts, in the WebAssembly module's file
// system (web/cxx.ts), where the C++ module reads and writes too. Run them in
// withFiles, which loads and saves the files around them.

export function writeFile(path: string, bytes: Uint8Array) {
  writeStamped(path, () => cxx().FS.writeFile(path, bytes));
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
  removeStamped(path, () => FS.unlink(path));
  return true;
}
