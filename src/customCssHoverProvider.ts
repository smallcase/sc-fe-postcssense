import * as vscode from 'vscode';
import postcss from 'postcss';
import { readFile } from 'fs/promises';
import * as path from 'path';

export class CustomCssHoverProvider implements vscode.HoverProvider {
  private cssCache: Map<
    string,
    { properties: Map<string, string>; lastUpdate: number }
  > = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Hover | null> {
    // Get the word at current position
    const range = document.getWordRangeAtPosition(position, /[\w-]+/);
    if (!range) {
      return null;
    }

    const word = document.getText(range);

    // Check if we're in a valid context (className, class, or composes)
    const line = document.lineAt(position.line).text;
    const isValidContext = this.isInValidContext(line, position.character);
    if (!isValidContext) {
      return null;
    }

    // Get CSS properties for the class
    const properties = await this.getCssProperties(document, word);
    if (!properties || properties.size === 0) {
      return null;
    }

    // Create markdown content
    const content = new vscode.MarkdownString();
    content.appendCodeblock(this.formatCssProperties(word, properties), 'css');
    content.isTrusted = true;
    content.supportHtml = true;

    return new vscode.Hover(content, range);
  }

  private isInValidContext(line: string, position: number): boolean {
    const lineUptoCursor = line.slice(0, position);
    return (
      // Check for className in JSX
      /className\s*=\s*["'\`][^"']*$/.test(lineUptoCursor) ||
      // Check for class in HTML
      /class\s*=\s*["'\`][^"']*$/.test(lineUptoCursor) ||
      // Check for composes in CSS
      /composes\s*:\s*[^;]*$/.test(lineUptoCursor)
    );
  }

  private async getCssProperties(
    document: vscode.TextDocument,
    className: string
  ): Promise<Map<string, string> | null> {
    try {
      const config = vscode.workspace.getConfiguration(
        'shringarcss-intellisense'
      );
      const cssPath = config.get<string>('cssPath');

      if (!cssPath) {
        return null;
      }

      const rootPath = vscode.workspace.getWorkspaceFolder(document.uri)?.uri
        .fsPath;
      if (!rootPath) {
        return null;
      }

      const fullPath = path.join(rootPath, cssPath);

      // Check cache
      const cached = this.cssCache.get(fullPath);
      if (cached && Date.now() - cached.lastUpdate < this.CACHE_DURATION) {
        return this.filterPropertiesForClass(cached.properties, className);
      }

      // Read and parse CSS file
      const cssContent = await readFile(fullPath, 'utf-8');
      const result = await postcss([require('postcss-import')({})]).process(
        cssContent,
        {
          from: fullPath,
        }
      );

      const properties = await this.parseCssProperties(result.css);
      this.cssCache.set(fullPath, { properties, lastUpdate: Date.now() });

      return this.filterPropertiesForClass(properties, className);
    } catch (error) {
      console.error('Error getting CSS properties:', error);
      return null;
    }
  }

  private async parseCssProperties(css: string): Promise<Map<string, string>> {
    const properties = new Map<string, string>();
    const ast = postcss.parse(css);

    ast.walkRules((rule) => {
      rule.selectors.forEach((selector) => {
        const matches = selector.match(/\.?global(?:\((.+?)\)|\.(\S+))/);
        if (matches) {
          const className = matches[1] || matches[2];
          if (!properties.has(className)) {
            properties.set(className, '');
          }

          const props = Array.from(rule.nodes)
            .filter((node): node is postcss.Declaration => node.type === 'decl')
            .map((node) => `${node.prop}: ${node.value};`)
            .join('\n  ');

          properties.set(className, props);
        }
      });
    });

    return properties;
  }

  private filterPropertiesForClass(
    properties: Map<string, string>,
    className: string
  ): Map<string, string> {
    const result = new Map<string, string>();
    const value = properties.get(className);
    if (value) {
      result.set(className, value);
    }
    return result;
  }

  private formatCssProperties(
    className: string,
    properties: Map<string, string>
  ): string {
    const props = properties.get(className);
    if (!props) {
      return '';
    }

    return `.${className} {\n  ${props}\n}`;
  }
}
