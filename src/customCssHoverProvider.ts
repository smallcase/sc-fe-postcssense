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

      // Check for className attribute with quotes
      const classNameAttributeRegex = /className\s*=\s*["'`]([^"'`]*)["'`]/g;
      let match;

      while ((match = classNameAttributeRegex.exec(line)) !== null) {
        const classNameAttributeValue = match[1];
        const classes = classNameAttributeValue.split(/\s+/);

        if (classes.includes(word)) {
          return this.createHoverForClass(word);
        }
      }

      // Check for template literals in className with various formats:
      // 1. Basic template literal: className={`class1 class2`}
      // 2. With expressions: className={`class1 ${condition ? 'class2' : 'class3'}`}
      // 3. Conditional classes: className={`${isSomething ? 'active' : ''} base-class`}
      const templateLiteralRegex = /className\s*=\s*{\s*`([^`]*)`\s*}/g;
      let tlMatch;

      while ((tlMatch = templateLiteralRegex.exec(line)) !== null) {
        const templateContent = tlMatch[1];
        const classes = templateContent.split(/\s+/).filter(Boolean);

        if (classes.includes(word)) {
          return this.createHoverForClass(word);
        }
      }

      // Check for the hovered word inside any template literal in a className context
      // This is a more general approach that works with various template literal formats
      if (line.includes('className={`') && line.includes(word)) {
        const startBacktick = line.indexOf('`', line.indexOf('className={'));
        if (startBacktick !== -1) {
          const endBacktick = line.indexOf('`', startBacktick + 1);
          if (endBacktick !== -1) {
            const templateContent = line.substring(
              startBacktick + 1,
              endBacktick
            );
            // Check if word is in the template - use word boundaries to avoid partial matches
            const wordRegex = new RegExp(`\\b${word}\\b`);
            if (wordRegex.test(templateContent)) {
              return this.createHoverForClass(word);
            }
          }
        }
      }

      // Handle complex template literals with ternaries and expressions
      // This handles cases like: className={`${active ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
      const complexTemplateRegex = /className\s*=\s*{.*?(['"])([^'"]*)\1.*?}/g;
      let complexMatch;

      while ((complexMatch = complexTemplateRegex.exec(line)) !== null) {
        const quotedClassNames = complexMatch[2];
        const classes = quotedClassNames.split(/\s+/).filter(Boolean);

        if (classes.includes(word)) {
          return this.createHoverForClass(word);
        }
      }

      // Handle direct variable class names
      // This handles cases like: className={someClassVar}
      if (line.includes('className={') && line.includes(word)) {
        // Check if the word appears as a standalone variable in a className assignment
        const varMatch = line.match(
          new RegExp(`className\\s*=\\s*{\\s*${word}\\s*}`)
        );
        if (varMatch) {
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
            // Add resolver for imports that handles both node_modules and relative paths
            resolve: (id: string, basedir: string) => {
              // Check if the import is a package import (starts with @, ~ or doesn't start with .)
              if (
                id.startsWith('@') ||
                id.startsWith('~') ||
                !id.startsWith('.')
              ) {
                // Try to resolve from node_modules
                return path.resolve(
                  workspaceFolder.uri.fsPath,
                  'node_modules',
                  id
                );
              }
              // Otherwise, it's a relative import
              return path.resolve(basedir, id);
            },
          }),
        ]).process(cssContent, { from: cssFilePath });

        // Clear previous class definitions
        classDefinitions.clear();

        // Parse the processed CSS (with imports) - includes both imported and local CSS
        const ast = postcss.parse(result.css);

        // Extract class definitions
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

        // 3. CSS Modules :global syntax
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
            classes.push(
              className.startsWith('.') ? className.substring(1) : className
            );
          }
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

            // Check for duplicates before adding
            const mediaRules = classEntry.medias.get(mediaQuery)!;
            const isDuplicate = mediaRules.some((existingRule) =>
              this.isSameRule(existingRule, rule)
            );

            if (!isDuplicate) {
              mediaRules.push(rule);
            }
          } else {
            // Check for duplicates before adding to regular rules
            const isDuplicate = classEntry.rules.some((existingRule) =>
              this.isSameRule(existingRule, rule)
            );

            if (!isDuplicate) {
              classEntry.rules.push(rule);
            }
          }
        });
      });
    });

    // Now process all collected rules and build the class definitions
    for (const [className, { rules, medias }] of classRules.entries()) {
      // Track processed properties to avoid duplicates
      const processedProps = new Set<string>();
      let properties = '';

      // First add regular rules
      rules.forEach((rule) => {
        rule.nodes.forEach((node) => {
          if (node.type === 'decl') {
            // Only add the property if we haven't seen it before
            if (!processedProps.has(node.prop)) {
              properties += properties
                ? `\n  ${node.toString()}`
                : node.toString();
              processedProps.add(node.prop);
            }
          }
        });
      });

      // Then add media queries
      medias.forEach((mediaRules, mediaQuery) => {
        properties += properties ? '\n  ' : '';
        properties += `@media ${mediaQuery} {\n`;

        // Track properties within this media query to avoid duplicates
        const mediaProcessedProps = new Set<string>();

        mediaRules.forEach((rule) => {
          rule.nodes.forEach((node) => {
            if (node.type === 'decl') {
              // Only add if we haven't seen this property in this media query
              if (!mediaProcessedProps.has(node.prop)) {
                properties += `    ${node.toString()}\n`;
                mediaProcessedProps.add(node.prop);
              }
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

  // Helper method to compare two rules to check if they're duplicates
  private isSameRule(rule1: postcss.Rule, rule2: postcss.Rule): boolean {
    // Rules are the same if they have the same selector and the same parent
    if (rule1.selector !== rule2.selector) {
      return false;
    }

    // Check if they have the same properties and values
    const props1 = rule1.nodes.filter(
      (n): n is postcss.Declaration => n.type === 'decl'
    );
    const props2 = rule2.nodes.filter(
      (n): n is postcss.Declaration => n.type === 'decl'
    );

    if (props1.length !== props2.length) {
      return false;
    }

    // Check if all properties in rule1 are also in rule2 with the same values
    return props1.every((prop1) =>
      props2.some(
        (prop2) => prop2.prop === prop1.prop && prop2.value === prop1.value
      )
    );
  }
}
