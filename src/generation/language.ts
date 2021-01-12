import { Shortcode } from "../translations/languages";
import { logDoneSection, logSection, reportError } from "./log";
import * as Path from "path";
import { writeFile } from "./file-utils";
import { SectionDetails } from "./section-details";

const translationsDir: string = Path.join(__dirname, "../translations");
const valuesDir: string = Path.join(__dirname, "../values");

const baseLanguageShortcode: Shortcode = "en-gb";

const sectionInterfaceFilePath: string = Path.join(valuesDir, "sections.interface.ts");
const languageInterfaceFilePath: string = Path.join(valuesDir, "language.interface.ts");

const generatedFilePrefix: string = `// ********************************
// This file is generated by a tool
// ********************************
`;

let baseLanguageFullSections: SectionDetails[];

export class Language {
  public readonly shortcode: Shortcode;
  public readonly name: string;
  public readonly parentShortcode?: Shortcode;
  public readonly basePath: string;

  public readonly sectionDetails: SectionDetails[] = [];

  private languageFilePath: string;
  private languageFile: string = "";
  private languageInterfaceFile: string = "";
  private sectionInterfaceFile: string = "";

  public get shortcodeNoDash(): string {
    return this.shortcode.split("-").join("");
  }

  public get parentShortcodeNoDash(): string | undefined {
    return this.parentShortcode?.split("-").join("");
  }

  public get isBaseLanguage(): boolean {
    return this.shortcode === baseLanguageShortcode;
  }

  constructor(
    shortcode: Shortcode,
    name: string | undefined,
    parentShortcode: Shortcode | undefined
  ) {
    this.shortcode = shortcode;
    this.name = name ?? reportError(`Language ${shortcode} needs a name`);

    if (!parentShortcode && !this.isBaseLanguage) {
      reportError(
        `Language ${shortcode}, ${name} needs to extend another language. Only ${baseLanguageShortcode} does not extend another language`
      );
    } else if (!!parentShortcode && this.isBaseLanguage) {
      reportError(`Language ${shortcode}, ${name} cannot extend another language`);
    }

    this.parentShortcode = parentShortcode;
    this.basePath = Path.join(translationsDir, shortcode);

    this.languageFilePath = Path.join(valuesDir, this.shortcode + ".ts");

    this.addToLanguageFile([
      generatedFilePrefix,
      `import { interpolate } from "../translation-utils";`,
      `import { ILanguage } from "./language.interface";`,
      `import * as Sections from "./sections.interface";`,
      !parentShortcode
        ? ``
        : `import * as ${this.parentShortcodeNoDash} from "./${parentShortcode}";\n`,
      `// Sections`,
      ``
    ]);

    this.addToLanguageInterfaceFile([
      generatedFilePrefix,
      `import { ILanguageMetadata } from "../types/language-metadata.interface";`,
      `import * as Sections from "./sections.interface";`,
      ``,
      `// Language`,
      ``,
      `export interface ILanguage {`,
      `  metadata: ILanguageMetadata;`
    ]);

    this.addTosectionInterfaceFile([
      generatedFilePrefix,
      `import { StringTranslation } from "../types/translations";`,
      ``,
      `// Sections`
    ]);
  }

  public addSectionDetails(sectionDetails: SectionDetails): void {
    this.sectionDetails.push(sectionDetails);

    this.addToLanguageFile([
      `export const ${sectionDetails.varName}: Sections.${sectionDetails.interfaceName} = {`,
      sectionDetails.text,
      "};"
    ]);

    this.addTosectionInterfaceFile([
      ``,
      `export interface ${sectionDetails.interfaceName} {`,
      `${sectionDetails.interfaceText}}`
    ]);

    this.addToLanguageInterfaceFile([
      `  "${sectionDetails.key}": Sections.${sectionDetails.interfaceName};`
    ]);
  }

  public async writeFilesToDisk(): Promise<void> {
    if (this.isBaseLanguage) {
      baseLanguageFullSections = this.sectionDetails;
    }

    const promises: Promise<void>[] = [];

    this.addLanguageImplementationToLanguageFile();
    promises.push(writeFile(this.languageFilePath, this.languageFile));

    if (this.isBaseLanguage) {
      logSection(
        `Writing Section and Language files as the current shortcode is ${baseLanguageShortcode}`
      );

      this.addToLanguageInterfaceFile(["}"]);

      promises.push(writeFile(sectionInterfaceFilePath, this.sectionInterfaceFile));
      promises.push(writeFile(languageInterfaceFilePath, this.languageInterfaceFile));
      logDoneSection();
    }

    await Promise.all(promises);
  }

  private addToLanguageFile(value: string | string[]): void {
    if (typeof value === "string") {
      this.languageFile += value;
      return;
    }

    this.languageFile += value.join("\n") + "\n";
  }

  private addToLanguageInterfaceFile(value: string | string[]): void {
    if (typeof value === "string") {
      this.languageInterfaceFile += value;
      return;
    }

    this.languageInterfaceFile += value.join("\n") + "\n";
  }

  private addTosectionInterfaceFile(value: string | string[]): void {
    if (typeof value === "string") {
      this.sectionInterfaceFile += value;
      return;
    }

    this.sectionInterfaceFile += value.join("\n") + "\n";
  }

  private addLanguageImplementationToLanguageFile(): void {
    this.addToLanguageFile([
      ``,
      `// Language`,
      ``,
      `export const ${this.shortcodeNoDash}: ILanguage = {`,
      `  metadata: {`,
      `    shortcode: "${this.shortcode}",`,
      `    name: "${this.name}"`,
      `  },${baseLanguageFullSections.map(
        (s, i) =>
          `\n  "${s.key}": ${
            this.sectionDetails[i]?.varName ?? `${this.parentShortcodeNoDash}.${s.varName}`
          },`
      )}`,
      `};`,
      ``,
      `export default ${this.shortcodeNoDash};`
    ]);
  }
}