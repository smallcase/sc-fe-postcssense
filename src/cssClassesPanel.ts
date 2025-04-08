import * as vscode from 'vscode';
import * as path from 'path';
import { readFile } from 'fs/promises';
import { glob } from 'glob';
import postcss from 'postcss';

interface ClassUsage {
  className: string;
  properties: string;
}

export class CssClassesPanel {
  public static currentPanel: CssClassesPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private _classUsages: ClassUsage[] = [];

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.html = this._getWebviewContent();
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'search':
            await this._handleSearch(message.text);
            break;
        }
      },
      null,
      this._disposables
    );
  }

  public static async createOrShow(extensionUri: vscode.Uri): Promise<void> {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it.
    if (CssClassesPanel.currentPanel) {
      CssClassesPanel.currentPanel._panel.reveal(column);
      return;
    }

    // Otherwise, create a new panel.
    const panel = vscode.window.createWebviewPanel(
      'cssClassesPanel',
      'PostCSS Classes',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    CssClassesPanel.currentPanel = new CssClassesPanel(panel, extensionUri);
    await CssClassesPanel.currentPanel._refresh();
  }

  // Public method to refresh the panel when CSS files change
  public async refresh(): Promise<void> {
    await this._refresh();
  }

  private async _refresh() {
    // Set loading state
    this._panel.webview.postMessage({ command: 'setLoading', loading: true });

    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        throw new Error('No workspace folder found');
      }

      const config = vscode.workspace.getConfiguration('postcssense');
      const cssPath = config.get<string>('cssPath');
      if (!cssPath) {
        throw new Error('CSS path not configured');
      }

      // Read and parse CSS file
      const cssFilePath = path.join(workspaceFolder.uri.fsPath, cssPath);
      const cssContent = await readFile(cssFilePath, 'utf-8');

      // Configure PostCSS with import plugin
      const result = await postcss([
        require('postcss-import')({
          root: workspaceFolder.uri.fsPath,
          // This ensures we get the full resolved path for imports
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
      ]).process(cssContent, {
        from: cssFilePath,
        map: { inline: false, annotation: false, sourcesContent: true },
      });

      // Parse CSS classes and their properties
      const classProperties = new Map<string, string>();

      // Parse the processed CSS (with imports) which includes both imported and local CSS
      const ast = postcss.parse(result.css);

      // Helper function to get properties from a rule
      const getPropertiesFromRule = (rule: postcss.Rule): string => {
        return Array.from(rule.nodes)
          .filter((node): node is postcss.Declaration => node.type === 'decl')
          .map((node) => `${node.prop}: ${node.value};`)
          .join('\n  ');
      };

      // Process rules and media queries
      ast.walkRules((rule) => {
        // Skip rules inside keyframes
        const parentAtRule =
          rule.parent?.type === 'atrule'
            ? (rule.parent as postcss.AtRule)
            : null;
        if (parentAtRule?.name === 'keyframes') {
          return;
        }

        rule.selectors.forEach((selector) => {
          // Try global() syntax first
          const globalMatches = selector.match(
            /\.?global(?:\((.+?)\)|\.(\S+))/
          );

          // Try :global syntax (common in CSS modules)
          const globalPrefixMatches = selector.match(
            /:global\s*(?:\(([^)]+)\)|\.([^:\s.]+)|\(\.([^:\s.]+)\))/
          );

          let className = null;

          if (globalMatches) {
            className = globalMatches[1] || globalMatches[2];
          } else if (globalPrefixMatches) {
            // Handle different :global syntaxes
            className =
              globalPrefixMatches[1] ||
              globalPrefixMatches[2] ||
              globalPrefixMatches[3];
            // Remove leading dot if present
            if (className && className.startsWith('.')) {
              className = className.substring(1);
            }
          } else {
            // Then try regular CSS class selectors
            const classMatch = selector.match(/^\.([A-Za-z0-9_-]+)/);
            if (classMatch) {
              className = classMatch[1];
            }
          }

          if (className) {
            // Get existing properties and track which ones we've seen
            let existingProps = classProperties.get(className) || '';
            let processedProps = new Map<string, boolean>();

            // Extract existing property names if there are any
            if (existingProps) {
              // Extract all property names from existing properties
              const propRegex = /\s*([a-zA-Z\-]+):/g;
              let match;
              while ((match = propRegex.exec(existingProps)) !== null) {
                if (match[1]) {
                  processedProps.set(match[1], true);
                }
              }
            }

            // If the rule is inside a media query
            if (parentAtRule?.name === 'media') {
              const mediaQuery = parentAtRule.params;

              // Only get properties we haven't seen yet
              const mediaPropsArray = Array.from(rule.nodes)
                .filter((node): node is postcss.Declaration => {
                  return node.type === 'decl' && !processedProps.has(node.prop);
                })
                .map((node) => `${node.prop}: ${node.value};`);

              // If we have unique properties, add them
              if (mediaPropsArray.length > 0) {
                const mediaProps = mediaPropsArray.join('\n  ');
                const mediaBlock = `\n  @media ${mediaQuery} {\n    ${mediaProps.replace(
                  /\n  /g,
                  '\n    '
                )}\n  }`;

                classProperties.set(
                  className,
                  existingProps
                    ? `${existingProps}${mediaBlock}`
                    : mediaBlock.trim()
                );

                // Update the processed properties
                mediaPropsArray.forEach((prop) => {
                  const propName = prop.split(':')[0].trim();
                  processedProps.set(propName, true);
                });
              }
            } else {
              // Regular properties - only include ones we haven't seen
              const newPropsArray = Array.from(rule.nodes)
                .filter((node): node is postcss.Declaration => {
                  return node.type === 'decl' && !processedProps.has(node.prop);
                })
                .map((node) => `${node.prop}: ${node.value};`);

              // If we have unique properties, add them
              if (newPropsArray.length > 0) {
                const newProps = newPropsArray.join('\n  ');
                classProperties.set(
                  className,
                  existingProps ? `${existingProps}\n  ${newProps}` : newProps
                );

                // Update the processed properties
                newPropsArray.forEach((prop) => {
                  const propName = prop.split(':')[0].trim();
                  processedProps.set(propName, true);
                });
              }
            }
          }
        });
      });

      // Create class usage objects
      this._classUsages = Array.from(classProperties.entries()).map(
        ([className, properties]) => ({
          className,
          properties,
        })
      );
    } catch (error: any) {
      vscode.window.showErrorMessage(
        `Error updating class usages: ${error.message}`
      );
    }

    // Update the classes and hide loading state
    this._panel.webview.postMessage({
      command: 'updateClasses',
      classes: this._classUsages,
    });
  }

  private async _handleSearch(searchText: string) {
    const filteredClasses = this._classUsages.filter((usage) =>
      usage.className.toLowerCase().includes(searchText.toLowerCase())
    );
    this._panel.webview.postMessage({
      command: 'updateClasses',
      classes: filteredClasses,
    });
  }

  private _getWebviewContent() {
    return `<!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <link href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css" rel="stylesheet" />
        <style>
          body {
            padding: 20px;
            font-family: var(--vscode-font-family);
            color: var(--vscode-editor-foreground);
          }
          .search-container {
            margin-bottom: 20px;
          }
          #searchInput {
            width: 100%;
            padding: 8px;
            font-size: 14px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
          }
          .class-item {
            margin-bottom: 20px;
            padding: 10px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
          }
          .class-header {
            margin-bottom: 10px;
          }
          .class-name {
            font-weight: bold;
            color: var(--vscode-symbolIcon-classForeground);
          }
          .properties {
            padding: 10px;
            background: var(--vscode-textCodeBlock-background);
            font-family: var(--vscode-editor-font-family);
            white-space: pre;
            margin: 0;
          }

          /* Loading Spinner */
          .loader-container {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            align-items: center;
            justify-content: center;
            z-index: 1000;
          }
          .loader-container.show {
            display: flex;
          }
          .loader {
            width: 50px;
            height: 50px;
            border: 5px solid var(--vscode-editor-foreground);
            border-bottom-color: transparent;
            border-radius: 50%;
            display: inline-block;
            box-sizing: border-box;
            animation: rotation 1s linear infinite;
          }
          @keyframes rotation {
            0% {
              transform: rotate(0deg);
            }
            100% {
              transform: rotate(360deg);
            }
          }
          
          /* Override Prism styles to match VS Code theme */
          code[class*="language-"],
          pre[class*="language-"] {
            color: var(--vscode-editor-foreground);
            background: var(--vscode-textCodeBlock-background);
            text-shadow: none;
            font-family: var(--vscode-editor-font-family);
            font-size: 1em;
            text-align: left;
            white-space: pre;
            word-spacing: normal;
            word-break: normal;
            word-wrap: normal;
            line-height: 1.5;
            tab-size: 2;
            hyphens: none;
          }
          
          /* Enhanced syntax highlighting */
          .token.selector { color: #ffa07a !important; }
          .token.property { color: #9cdcfe !important; }
          .token.punctuation { color: #d4d4d4 !important; }
          .token.value { color: #ce9178 !important; }
          .token.unit { color: #b5cea8 !important; }
          .token.number { color: #b5cea8 !important; }
          .token.important { color: #569cd6 !important; }
          .token.atrule { color: #c586c0 !important; }
          .token.atrule .rule { color: #569cd6 !important; }
          .token.string { color: #ce9178 !important; }
        </style>
      </head>
      <body>
        <div class="loader-container">
          <div class="loader"></div>
        </div>
        <div class="search-container">
          <input type="text" id="searchInput" placeholder="Search CSS classes...">
        </div>
        <div id="classList"></div>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-css.min.js"></script>
        <script>
          const vscode = acquireVsCodeApi();
          const searchInput = document.getElementById('searchInput');
          const loaderContainer = document.querySelector('.loader-container');
          let classes = [];

          searchInput.addEventListener('input', () => {
            vscode.postMessage({
              command: 'search',
              text: searchInput.value
            });
          });

          window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
              case 'setLoading':
                loaderContainer.classList.toggle('show', message.loading);
                break;
              case 'updateClasses':
                classes = message.classes;
                updateClassList();
                loaderContainer.classList.remove('show');
                break;
            }
          });

          function formatCssProperties(className, properties) {
            // If className already starts with a dot, don't add another one
            const selector = className.startsWith('.') ? className : \`.\${className}\`;
            return \`\${selector} {
  \${properties}
}\`;
          }

          function updateClassList() {
            const classList = document.getElementById('classList');
            classList.innerHTML = classes.map(classInfo => \`
              <div class="class-item">
                <div class="class-header">
                  <span class="class-name">\${classInfo.className}</span>
                </div>
                <pre class="properties"><code class="language-css">\${formatCssProperties(classInfo.className, classInfo.properties)}</code></pre>
              </div>
            \`).join('');
            
            // Highlight all code blocks after a short delay to ensure DOM is updated
            setTimeout(() => {
              Prism.highlightAll();
            }, 0);
          }
        </script>
      </body>
    </html>`;
  }

  public dispose() {
    CssClassesPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
