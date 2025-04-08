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

    // Check if we're in a basic className or class context with quotes
    const isInBasicClassContext =
      /(class|className)\s*=\s*["']([^"']*)$/.test(linePrefix) || // Inside quotes
      /(class|className)\s*=\s*$/.test(linePrefix); // Just after =

    // Check if we're in a template literal context
    const isInTemplateLiteralContext = /className\s*=\s*{\s*`[^`]*$/.test(
      linePrefix
    );

    // Check if we're in a complex expression with string literals
    const isInComplexExpressionContext = /className\s*=\s*{.*?['"][^'"]*$/.test(
      linePrefix
    );

    if (
      !isInBasicClassContext &&
      !isInTemplateLiteralContext &&
      !isInComplexExpressionContext
    ) {
      return [];
    }

    // Get current classes depending on context
    let currentClasses: string[] = [];

    if (isInBasicClassContext) {
      // Extract current classes if we're inside quotes
      currentClasses =
        linePrefix
          .match(/(class|className)\s*=\s*["']([^"']*)$/)?.[2]
          ?.split(/\s+/)
          .filter(Boolean) || [];
    } else if (isInTemplateLiteralContext) {
      // Extract classes inside template literal
      const templateMatch = linePrefix.match(/className\s*=\s*{\s*`([^`]*)$/);
      if (templateMatch) {
        currentClasses = templateMatch[1].split(/\s+/).filter(Boolean);
      }
    } else if (isInComplexExpressionContext) {
      // Try to extract classes from the most recent string literal
      const stringMatch = linePrefix.match(/['"]([^'"]+)$/);
      if (stringMatch) {
        currentClasses = stringMatch[1].split(/\s+/).filter(Boolean);
      }
    }

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
          `CSS class from PostCSS`
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
    try {
      const config = workspace.getConfiguration('postcssense');
      const cssPath = config.get<string>('cssPath');
      if (!cssPath) {
        console.warn('CSS path not configured');
        return [];
      }

      const workspaceFolder = workspace.getWorkspaceFolder(document.uri);
      if (!workspaceFolder) {
        console.warn('No workspace folder found');
        return [];
      }

      const rootPath = workspaceFolder.uri.fsPath;
      const cssFilePath = path.join(rootPath, cssPath);
      const cssContent = await readFile(cssFilePath, 'utf-8');

      // Process imports
      const result = await postcss([
        require('postcss-import')({
          root: workspaceFolder.uri.fsPath,
          // Add resolver for imports that handles both node_modules and relative paths
          resolve: (id: string, basedir: string) => {
            // Check if the import is a package import (starts with @, ~ or doesn't start with .)
            if (
              id.startsWith('@') ||
              id.startsWith('~') ||
              !id.startsWith('.')
            ) {
              // Try to resolve from node_modules
              return path.resolve(rootPath, 'node_modules', id);
            }
            // Otherwise, it's a relative import
            return path.resolve(basedir, id);
          },
        }),
      ]).process(cssContent, {
        from: cssFilePath,
      });

      // Parse the processed CSS which includes both imported and local CSS
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
    // Skip rules inside keyframes
    const parentAtRule =
      rule.parent?.type === 'atrule' ? (rule.parent as postcss.AtRule) : null;
    if (parentAtRule?.name === 'keyframes') {
      return;
    }

    rule.selectors.forEach((selector) => {
      // Try to match global() function syntax first
      const globalMatches = selector.match(/\.?global(?:\((.+?)\)|\.(\S+))/);
      if (globalMatches) {
        const className = globalMatches[1] || globalMatches[2];
        cssClasses.push(className.replace(/^\./, ''));
        return;
      }

      // Try to match :global CSS modules syntax
      const globalPrefixMatches = selector.match(
        /:global\s*(?:\(([^)]+)\)|\.([^:\s.]+)|\(\.([^:\s.]+)\))/
      );
      if (globalPrefixMatches) {
        const className =
          globalPrefixMatches[1] ||
          globalPrefixMatches[2] ||
          globalPrefixMatches[3];
        if (className) {
          // Remove leading dot if present
          cssClasses.push(
            className.startsWith('.') ? className.substring(1) : className
          );
        }
        return;
      }

      // Then try to match regular CSS class selectors
      const classMatches = selector.match(/\.([\w\-]+)/g);
      if (classMatches) {
        classMatches.forEach((match) => {
          // Remove the leading dot
          cssClasses.push(match.substring(1));
        });
      }
    });
  });

  return Array.from(new Set([...cssClasses]));
}
