/// <reference lib="dom" />

// File I/O on the Origin Private File System, the browser's sandboxed,
// persistent file storage. Paths are relative to its root, as in
// "roundtrip/full.json"; a leading slash is ignored.

async function directoryOf(path: string, create: boolean) {
  const parts = path.split('/').filter(Boolean);
  const name = parts.pop();
  if (name === undefined) {
    throw new Error(`Not a file path: ${path}`);
  }
  let directory = await navigator.storage.getDirectory();
  for (const part of parts) {
    directory = await directory.getDirectoryHandle(part, { create });
  }
  return { directory, name };
}

function isNotFound(error: unknown) {
  return error instanceof DOMException && error.name === 'NotFoundError';
}

export async function writeFile(path: string, bytes: Uint8Array) {
  const { directory, name } = await directoryOf(path, true);
  const file = await directory.getFileHandle(name, { create: true });
  const writable = await file.createWritable();
  await writable.write(bytes as Uint8Array<ArrayBuffer>);
  await writable.close();
}

// Resolves null when the file doesn't exist.
export async function readFile(path: string): Promise<Uint8Array | null> {
  try {
    const { directory, name } = await directoryOf(path, false);
    const file = await (await directory.getFileHandle(name)).getFile();
    return new Uint8Array(await file.arrayBuffer());
  } catch (error) {
    if (isNotFound(error)) {
      return null;
    }
    throw error;
  }
}

// Resolves false when the file doesn't exist.
export async function removeFile(path: string): Promise<boolean> {
  try {
    const { directory, name } = await directoryOf(path, false);
    await directory.removeEntry(name);
    return true;
  } catch (error) {
    if (isNotFound(error)) {
      return false;
    }
    throw error;
  }
}
