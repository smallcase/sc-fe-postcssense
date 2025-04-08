import * as vscode from 'vscode';
import { CustomCssCompletionProvider } from './customCssCompletionProvider';
import { CustomCssHoverProvider } from './customCssHoverProvider';
import { CssClassesPanel } from './cssClassesPanel';

export function activate(context: vscode.ExtensionContext) {
  const completionProvider = new CustomCssCompletionProvider();
  const hoverProvider = new CustomCssHoverProvider();

  // Initialize hover provider by loading class definitions
  hoverProvider.updateClassDefinitions().then(() => {
    console.log('Class definitions initialized');
  });

  // Register completion provider for multiple languages
  const languages = [
    'css',
    'html',
    'javascript',
    'javascriptreact',
    'typescriptreact',
  ];

  // Different trigger characters for CSS and HTML/JSX/TSX
  const cssProvider = vscode.languages.registerCompletionItemProvider(
    { scheme: 'file', language: 'css' },
    completionProvider,
    ':'
  );

  // For HTML/JSX/TSX we want to trigger on quotes, space, and className=
  const htmlJsxProvider = languages
    .filter((lang) => lang !== 'css')
    .map((language) =>
      vscode.languages.registerCompletionItemProvider(
        { scheme: 'file', language },
        completionProvider,
        ' ',
        '"',
        "'",
        '='
      )
    );

  // Register hover provider for all supported languages
  const hoverProviders = languages.map((language) =>
    vscode.languages.registerHoverProvider(
      { scheme: 'file', language },
      hoverProvider
    )
  );

  // Register command to show CSS classes panel
  const showClassesPanelCommand = vscode.commands.registerCommand(
    'postcssense.showClasses',
    () => {
      CssClassesPanel.createOrShow(context.extensionUri);
    }
  );

  // Watch for CSS file changes
  const cssFileWatcher = vscode.workspace.createFileSystemWatcher('**/*.css');
  cssFileWatcher.onDidChange(() => {
    console.log('CSS file changed, updating class definitions');
    hoverProvider.updateClassDefinitions();
    // Refresh the CSS classes panel if it's open
    if (CssClassesPanel.currentPanel) {
      CssClassesPanel.currentPanel.refresh();
    }
  });
  cssFileWatcher.onDidCreate(() => {
    console.log('CSS file created, updating class definitions');
    hoverProvider.updateClassDefinitions();
    // Refresh the CSS classes panel if it's open
    if (CssClassesPanel.currentPanel) {
      CssClassesPanel.currentPanel.refresh();
    }
  });

  context.subscriptions.push(
    cssProvider,
    ...htmlJsxProvider,
    ...hoverProviders,
    showClassesPanelCommand,
    cssFileWatcher
  );

  // Register command to set CSS path
  const setCssPathCommand = vscode.commands.registerCommand(
    'postcssense.setCssPath',
    async () => {
      const result = await vscode.window.showInputBox({
        prompt:
          'Enter the path to your root CSS file (relative to workspace root). This file should contain all the global class definitions or import other CSS files.',
        placeHolder: 'e.g., node_modules/your-css-package/index.css',
      });

      if (result) {
        const config = vscode.workspace.getConfiguration('postcssense');
        await config.update(
          'cssPath',
          result,
          vscode.ConfigurationTarget.Workspace
        );
        vscode.window.showInformationMessage('CSS path updated successfully!');
      }
    }
  );

  context.subscriptions.push(setCssPathCommand);
}
