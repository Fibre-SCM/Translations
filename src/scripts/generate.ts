import * as FS from "fs";
import * as Path from "path";
import { interpolationRegex } from "../translation-utils";
import { languages, Shortcode } from "../translations/languages";
import { Language } from "../types/language.interface";
import {
  ArgTranslation,
  isArgTranslation,
  isStringTranslation,
  Translation,
  Translations
} from "../types/translations";
import { SectionDetails } from "./section-details";

const projDir: string = Path.join(__dirname, "../../");
const srcDir: string = Path.join(projDir, "./src");
const translationsDir: string = Path.join(srcDir, "./translations");
const valuesDir: string = Path.join(srcDir, "./values");

async function run(): Promise<void> {
  console.log("Cleaning values folder");
  await delFolder(valuesDir);
  await createFolder(valuesDir);

  const foundLanguageNames: Set<string> = new Set<string>();

  for (const shortcode of Object.keys(languages) as Shortcode[]) {
    const language: Language<Shortcode> = languages[shortcode];

    if (!language.name) {
      throw new Error(`Language ${shortcode} needs a name`);
    }

    if (foundLanguageNames.has(language.name)) {
      throw new Error(
        `Language ${shortcode} needs a distinct name, but ${language.name} has already been used.`
      );
    }

    foundLanguageNames.add(language.name);

    if (!language.extends && shortcode !== "en-gb") {
      throw new Error(`Language ${shortcode} needs to extend an other language`);
    }

    await loadLanguage(shortcode as Shortcode, language.name, language.extends);
  }
}

async function delFolder(path: string): Promise<void> {
  return new Promise<void>((resolve, reject) =>
    FS.rmdir(path, { recursive: true }, e => (!!e ? reject(e) : resolve()))
  );
}

async function createFolder(path: string): Promise<void> {
  return new Promise<void>((resolve, reject) =>
    FS.mkdir(path, { recursive: true }, e => (!!e ? reject(e) : resolve()))
  );
}

async function writeFile(path: string, content: string): Promise<void> {
  return new Promise<void>((resolve, reject) =>
    FS.writeFile(path, content, e => (!!e ? reject(e) : resolve()))
  );
}

async function childFolders(path: string): Promise<string[]> {
  return new Promise<string[]>((resolve, reject) =>
    FS.readdir(path, { withFileTypes: true }, (e, files) =>
      !!e ? reject(e) : resolve(files.filter(f => f.isDirectory()).map(f => f.name))
    )
  );
}

async function childFiles(path: string): Promise<string[]> {
  return new Promise<string[]>((resolve, reject) =>
    FS.readdir(path, { withFileTypes: true }, (e, files) =>
      !!e ? reject(e) : resolve(files.filter(f => f.isFile()).map(f => f.name))
    )
  );
}

async function loadLanguage(shortcode: Shortcode, name: string, parent: Shortcode): Promise<void> {
  console.log(`Loading ${shortcode}, ${name}, which extends ${parent}`);

  const shortcodeNoDash: string = shortcode.split("-").join("");
  const baseFolder: string = Path.join(translationsDir, `./${shortcode}`);

  let currentFile: string = `// ********************************
// This file is generated by a tool
// ********************************

import { interpolate } from "../translation-utils";
import { ILanguage } from "./language.interface";
import * as Sections from "./section.interface";

// Sections
`;

  const sections: SectionDetails[] = await loadLanguageFolder(
    baseFolder,
    new SectionDetails(),
    shortcode
  );

  for (const section of sections) {
    currentFile += `\nexport const ${section.varName}: Sections.${section.interfaceName} = {\n`;
    currentFile += section.text;
    currentFile += "};\n";
  }

  currentFile += `
// Language

export const ${shortcodeNoDash}: ILanguage = {
  metadata: {
    shortcode: "${shortcode}",
    name: "${name}"
  },
};

export default ${shortcodeNoDash};
`;

  await writeFile(Path.join(valuesDir, shortcode + ".ts"), currentFile);
}

async function loadLanguageFolder(
  parentPath: string,
  sectionDetails: SectionDetails,
  shortcode: Shortcode
): Promise<SectionDetails[]> {
  const childSectionDetails: SectionDetails[] = [];

  const folders: string[] = await childFolders(parentPath);
  for (const folder of folders) {
    const folderPath: string = Path.join(parentPath, folder);
    const newSectionDetails: SectionDetails = sectionDetails.copy();
    newSectionDetails.add(folder);

    childSectionDetails.push(
      ...(await loadLanguageFolder(folderPath, newSectionDetails, shortcode))
    );
  }

  const files: string[] = await childFiles(parentPath);
  for (const file of files) {
    const filePath: string = Path.join(parentPath, file);
    const fileNameWithoutExtension: string = Path.parse(file).name;
    const newSectionDetails: SectionDetails = sectionDetails.copy();
    newSectionDetails.add(fileNameWithoutExtension);

    childSectionDetails.push(await loadLanguageFile(filePath, newSectionDetails, shortcode));
  }

  return childSectionDetails;
}

async function loadLanguageFile(
  path: string,
  sectionDetails: SectionDetails,
  shortcode: Shortcode
): Promise<SectionDetails> {
  console.log(`Loading file ${Path.relative(translationsDir, path)}`);

  const loadedModule: any = await import(path);
  const translations: Translations = loadedModule.translations;

  if (!translations) {
    throw new Error(`No translations found in the file ${path}`);
  }

  sectionDetails.text += loadObject(translations, "");

  return sectionDetails;
}

function loadObject(value: Translation | Translations, key: string): string {
  if (isStringTranslation(value)) {
    if (key.length === 0) {
      throw new Error("Found a top-level string value");
    }
    return `${key}: "${value}",\n`;
  }

  if (isArgTranslation(value)) {
    validateArgTranslation(value);

    const parameters: string = value.args?.map(v => `${v}: string`).join(", ") ?? "";
    const args: string = value.args?.join(", ") ?? "";
    return `${key}: (${parameters}) => interpolate("${value.value}", { ${args} }),\n`;
  }

  let result: string = "";

  if (!!key && key.length > 0) {
    result += `${key}: {\n`;
  }

  const keys: string[] = Object.keys(value);
  for (const childKey of keys) {
    result += loadObject((value as any)[childKey] as Translations, childKey);
  }

  if (!!key && key.length > 0) {
    result += "},\n";
  }

  return result;
}

function validateArgTranslation(translation: ArgTranslation): void {
  const valuesToInterpolate: string[] =
    translation.value.match(interpolationRegex)?.map(m => m.substr(2, m.length - 3)) ?? [];

  if (valuesToInterpolate.length > 0 && !translation.args) {
    throw new Error(
      `No translation args were given for "${translation.value}" but interpolation variables were found`
    );
  }

  const args: string[] = translation.args ?? [];

  for (const value of valuesToInterpolate) {
    if (!args.includes(value)) {
      throw new Error(
        `The translation "${translation.value}" requires a value for ${value} but it was not declared`
      );
    }
  }
}

(async () => await run())();
