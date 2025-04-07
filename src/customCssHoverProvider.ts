import * as vscode from 'vscode';
import * as path from 'path';
import { readFile } from 'fs/promises';
import postcss from 'postcss';

// Cache for class definitions
let classDefinitions: Map<string, string> = new Map();
let lastUpdated = 0;

export class CustomCssHoverProvider implements vscode.HoverProvider {
  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Hover | null> {
    // Check if we need to refresh the class definitions
    const now = Date.now();
    if (now - lastUpdated > 5 * 60 * 1000 || classDefinitions.size === 0) {
      await this.updateClassDefinitions();
      lastUpdated = now;
    }

    const line = document.lineAt(position.line).text;
    const wordRange = document.getWordRangeAtPosition(position, /[\w\-\d]+/);

    if (!wordRange) {
      return null;
    }

    const word = document.getText(wordRange);

    // Check if this is in a composes statement in CSS
    if (
      document.languageId === 'css' &&
      line.includes('composes:') &&
      line.includes('from global')
    ) {
      // Extract classes from composes statement
      const composesMatch = line.match(/composes:\s*(.*?)\s+from\s+global/);
      if (composesMatch) {
        const classes = composesMatch[1].trim().split(/\s+/);

        // Check if hovered word is one of these classes
        if (classes.includes(word)) {
          return this.createHoverForClass(word);
        }
      }
    }

    // For HTML, check if word is inside a class attribute
    else if (document.languageId === 'html') {
      const classAttributeRegex = /class\s*=\s*["']([^"']*)["']/g;
      let match;

      while ((match = classAttributeRegex.exec(line)) !== null) {
        const classAttributeValue = match[1];
        const classes = classAttributeValue.split(/\s+/);

        if (classes.includes(word)) {
          return this.createHoverForClass(word);
        }
      }
    }

    // For JS/JSX/TS/TSX, check if word is inside a className attribute or global() function
    else if (
      [
        'javascript',
        'javascriptreact',
        'typescript',
        'typescriptreact',
      ].includes(document.languageId)
    ) {
      // Check for global() function
      const globalMatch = line.match(
        new RegExp(`global\\((["'\`])?${word}\\1\\)`)
      );
      if (globalMatch) {
        return this.createHoverForClass(word);
      }

      // Check for className attribute
      const classNameAttributeRegex = /className\s*=\s*["'`]([^"'`]*)["'`]/g;
      let match;

      while ((match = classNameAttributeRegex.exec(line)) !== null) {
        const classNameAttributeValue = match[1];
        const classes = classNameAttributeValue.split(/\s+/);

        if (classes.includes(word)) {
          return this.createHoverForClass(word);
        }
      }

      // Check for template literals in className
      const templateLiteralRegex = /className\s*=\s*{[^}]*`([^`]*)`[^}]*}/g;
      let tlMatch;

      while ((tlMatch = templateLiteralRegex.exec(line)) !== null) {
        const templateContent = tlMatch[1];
        const classes = templateContent.split(/\s+/);

        if (classes.includes(word)) {
          return this.createHoverForClass(word);
        }
      }
    }

    return null;
  }

  private createHoverForClass(className: string): vscode.Hover | null {
    const properties = classDefinitions.get(className);
    if (properties) {
      const formattedProperties = `.${className} {\n  ${properties}\n}`;
      return new vscode.Hover(
        new vscode.MarkdownString('```css\n' + formattedProperties + '\n```')
      );
    }
    return null;
  }

  public async updateClassDefinitions(): Promise<void> {
    try {
      // Get the user-provided CSS path from settings
      const config = vscode.workspace.getConfiguration('postcssense');
      const cssPath = config.get<string>('cssPath');

      if (!cssPath) {
        vscode.window.showErrorMessage(
          'CSS path is not configured. Please set postcssense.cssPath in settings.'
        );
        return;
      }

      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found.');
        return;
      }

      const cssFilePath = path.join(workspaceFolder.uri.fsPath, cssPath);

      try {
        // Read the CSS file
        const cssContent = await readFile(cssFilePath, 'utf-8');

        // Use PostCSS to parse and process imports
        const result = await postcss([
          require('postcss-import')({
            root: workspaceFolder.uri.fsPath,
          }),
        ]).process(cssContent, { from: cssFilePath });

        // Parse the processed CSS
        const ast = postcss.parse(result.css);
        classDefinitions.clear();

        // Extract class definitions from the CSS
        this.extractClassDefinitions(ast);

        vscode.window.setStatusBarMessage(
          `Found ${classDefinitions.size} CSS classes`,
          3000
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Error reading CSS file: ${error}`);
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `Error updating class definitions: ${error}`
      );
    }
  }

  private extractClassDefinitions(ast: postcss.Root): void {
    // Track rules for each class to handle both simple and complex selectors
    const classRules: Map<
      string,
      { rules: postcss.Rule[]; medias: Map<string, postcss.Rule[]> }
    > = new Map();

    // Walk through all rules in the AST
    ast.walkRules((rule) => {
      // Skip keyframes
      if (
        rule.parent?.type === 'atrule' &&
        (rule.parent as postcss.AtRule).name === 'keyframes'
      ) {
        return;
      }

      // Helper function to extract class names from a selector
      const extractClasses = (selector: string): string[] => {
        const classes: string[] = [];

        // Match class names in various formats
        // 1. Simple class selectors (.classname)
        const simpleMatches = selector.match(/\.([\w\-]+)/g);
        if (simpleMatches) {
          simpleMatches.forEach((match) => {
            const className = match.substring(1); // Remove the leading dot
            classes.push(className);
          });
        }

        // 2. Global function syntax (global(classname))
        const globalFuncMatches = selector.match(/global\(([\w\-]+)\)/g);
        if (globalFuncMatches) {
          globalFuncMatches.forEach((match) => {
            const className = match.substring(7, match.length - 1); // Remove global( and )
            classes.push(className);
          });
        }

        return classes;
      };

      // Process each selector in the rule
      rule.selectors.forEach((selector) => {
        const classes = extractClasses(selector);

        classes.forEach((className) => {
          // Get or create entry for this class
          if (!classRules.has(className)) {
            classRules.set(className, { rules: [], medias: new Map() });
          }

          const classEntry = classRules.get(className)!;

          // Check if this rule is inside a media query
          const parentAtRule =
            rule.parent?.type === 'atrule'
              ? (rule.parent as postcss.AtRule)
              : null;
          if (parentAtRule?.name === 'media') {
            const mediaQuery = parentAtRule.params;

            if (!classEntry.medias.has(mediaQuery)) {
              classEntry.medias.set(mediaQuery, []);
            }

            classEntry.medias.get(mediaQuery)!.push(rule);
          } else {
            classEntry.rules.push(rule);
          }
        });
      });
    });

    // Now process all collected rules and build the class definitions
    for (const [className, { rules, medias }] of classRules.entries()) {
      let properties = '';

      // First add regular rules
      rules.forEach((rule) => {
        rule.nodes.forEach((node) => {
          if (node.type === 'decl') {
            properties += properties
              ? `\n  ${node.toString()}`
              : node.toString();
          }
        });
      });

      // Then add media queries
      medias.forEach((mediaRules, mediaQuery) => {
        properties += properties ? '\n  ' : '';
        properties += `@media ${mediaQuery} {\n`;

        mediaRules.forEach((rule) => {
          rule.nodes.forEach((node) => {
            if (node.type === 'decl') {
              properties += `    ${node.toString()}\n`;
            }
          });
        });

        properties += '  }';
      });

      if (properties) {
        classDefinitions.set(className, properties);
      }
    }
  }
}
