import * as FS from "fs";
import * as Path from "path";

import { logInfo } from "./log";

const srcDir: string = Path.join(__dirname, "../");

export async function delFolder(path: string): Promise<void> {
  logInfo(`Deleting the folder: ${Path.relative(srcDir, path)}`);
  return new Promise<void>((resolve, reject) =>
    FS.rmdir(path, { recursive: true }, e => (!!e ? reject(e) : resolve()))
  );
}

export async function createFolder(path: string): Promise<void> {
  logInfo(`Creating the folder: ${Path.relative(srcDir, path)}`);
  return new Promise<void>((resolve, reject) =>
    FS.mkdir(path, { recursive: true }, e => (!!e ? reject(e) : resolve()))
  );
}

export async function folderExists(path: string): Promise<boolean> {
  return new Promise<boolean>((resolve, _) => {
    try {
      FS.stat(path, (e, s) => (!!e ? resolve(false) : resolve(s.isDirectory())));
    } catch {
      resolve(false);
    }
  });
}

export async function writeFile(path: string, content: string): Promise<void> {
  logInfo(`Writing the file: ${Path.relative(srcDir, path)}`);
  return new Promise<void>((resolve, reject) =>
    FS.writeFile(path, content, e => (!!e ? reject(e) : resolve()))
  );
}

export async function childFolders(path: string): Promise<string[]> {
  return new Promise<string[]>((resolve, reject) =>
    FS.readdir(path, { withFileTypes: true }, (e, files) =>
      !!e ? reject(e) : resolve(files.filter(f => f.isDirectory()).map(f => f.name))
    )
  );
}

export async function childFiles(path: string): Promise<string[]> {
  return new Promise<string[]>((resolve, reject) =>
    FS.readdir(path, { withFileTypes: true }, (e, files) =>
      !!e ? reject(e) : resolve(files.filter(f => f.isFile()).map(f => f.name))
    )
  );
}
