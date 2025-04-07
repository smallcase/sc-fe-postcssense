import vscode, {
  CompletionItemProvider,
  TextDocument,
  Position,
  CancellationToken,
  CompletionItem,
  CompletionItemKind,
  workspace,
} from 'vscode';
import * as path from 'path';
import { promisify } from 'util';
import { readFile as _readFile } from 'fs';
import postcss from 'postcss';

const readFile = promisify(_readFile);

export class CustomCssCompletionProvider implements CompletionItemProvider {
  async provideCompletionItems(
    document: TextDocument,
    position: Position,
    token: CancellationToken
  ): Promise<CompletionItem[]> {
    const line = document.lineAt(position.line).text;
    const languageId = document.languageId;

    // Handle CSS files
    if (languageId === 'css') {
      return this.handleCssCompletion(line, position, document);
    }

    // Handle HTML/JSX/TSX files
    if (
      ['html', 'javascript', 'javascriptreact', 'typescriptreact'].includes(
        languageId
      )
    ) {
      return this.handleHtmlCompletion(line, position, document);
    }

    return [];
  }

  private async handleCssCompletion(
    line: string,
    position: Position,
    document: TextDocument
  ): Promise<CompletionItem[]> {
    const composesIndex = line.lastIndexOf('composes:');
    if (composesIndex === -1 || position.character < composesIndex) {
      return [];
    }
    const textAfterComposes = line.substring(
      composesIndex + 'composes:'.length
    );
    const fromGlobalIndex = textAfterComposes.indexOf('from global;');
    if (fromGlobalIndex === -1) {
      return [];
    }
    const classNames = textAfterComposes.substring(0, fromGlobalIndex).trim();
    const cssClasses = await this.getCssClasses(document);

    return this.createCompletionItems(cssClasses, classNames);
  }

  private async handleHtmlCompletion(
    line: string,
    position: Position,
    document: TextDocument
  ): Promise<CompletionItem[]> {
    // Get the text up to the cursor position
    const linePrefix = line.slice(0, position.character);

    // Check if we're in a className or class context
    const isInClassContext =
      /(class|className)\s*=\s*["']([^"']*)$/.test(linePrefix) || // Inside quotes
      /(class|className)\s*=\s*$/.test(linePrefix); // Just after =

    if (!isInClassContext) {
      return [];
    }

    // Extract current classes if we're inside quotes
    const currentClasses =
      linePrefix
        .match(/(class|className)\s*=\s*["']([^"']*)$/)?.[2]
        ?.split(/\s+/)
        .filter(Boolean) || [];
    const cssClasses = await this.getCssClasses(document);

    // Create completion items
    return cssClasses
      .filter((cssClass) => !currentClasses.includes(cssClass))
      .map((cssClass) => {
        const completionItem = new CompletionItem(
          cssClass,
          CompletionItemKind.Value
        );
        completionItem.insertText = cssClass;

        // Add a space after if we're in the middle of existing classes
        if (currentClasses.length > 0) {
          completionItem.insertText = ' ' + cssClass;
        }

        // Add documentation
        completionItem.documentation = new vscode.MarkdownString(
          `CSS class from Shringar CSS framework`
        );

        return completionItem;
      });
  }

  private createCompletionItems(
    cssClasses: string[],
    existingClasses: string
  ): CompletionItem[] {
    return cssClasses
      .filter((cssClass) => existingClasses.split(' ').indexOf(cssClass) === -1)
      .map((cssClass) => {
        const completionItem = new CompletionItem(
          cssClass,
          CompletionItemKind.Variable
        );
        completionItem.insertText = cssClass;
        return completionItem;
      });
  }

  private async getCssClasses(document: TextDocument): Promise<string[]> {
    const config = workspace.getConfiguration('shringarcss-intellisense');
    const cssPath = config.get<string>('cssPath');

    if (!cssPath) {
      vscode.window.showErrorMessage(
        'Please set the CSS path using the "Shringar CSS: Set CSS Path" command'
      );
      return [];
    }

    const rootPath = workspace.getWorkspaceFolder(document.uri)?.uri.fsPath;
    if (!rootPath) {
      throw new Error('Unable to find workspace root path.');
    }

    const cssFilePath = path.join(rootPath, cssPath);
    try {
      const cssContent = await readFile(cssFilePath, 'utf-8');
      const result = await postcss([require('postcss-import')({})]).process(
        cssContent,
        {
          from: cssFilePath,
        }
      );

      return parseCssClasses(result.css);
    } catch (error: any) {
      vscode.window.showErrorMessage(
        `Failed to read CSS file: ${error.message}`
      );
      return [];
    }
  }
}

function parseCssClasses(cssContent: string): string[] {
  const cssAst = postcss.parse(cssContent);
  const cssClasses: string[] = [];

  cssAst.walkRules((rule) => {
    rule.selectors.forEach((selector) => {
      const matches = selector.match(/\.?global(?:\((.+?)\)|\.(\S+))/);

      if (matches) {
        const className = matches[1] || matches[2];
        cssClasses.push(className.replace('.', ''));
      }
    });
  });

  return Array.from(new Set([...cssClasses]));
}
