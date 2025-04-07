import * as vscode from 'vscode';
import { CustomCssCompletionProvider } from './customCssCompletionProvider';

export function activate(context: vscode.ExtensionContext) {
  const provider = new CustomCssCompletionProvider();

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
    provider,
    ':'
  );

  // For HTML/JSX/TSX we want to trigger on quotes, space, and className=
  const htmlJsxProvider = languages
    .filter((lang) => lang !== 'css')
    .map((language) =>
      vscode.languages.registerCompletionItemProvider(
        { scheme: 'file', language },
        provider,
        ' ',
        '"',
        "'",
        '='
      )
    );

  context.subscriptions.push(cssProvider, ...htmlJsxProvider);

  // Register command to set CSS path
  const setCssPathCommand = vscode.commands.registerCommand(
    'shringarcss-intellisense.setCssPath',
    async () => {
      const result = await vscode.window.showInputBox({
        prompt: 'Enter the path to your CSS file (relative to workspace root)',
        placeHolder: 'e.g., node_modules/@smallcase/shringar/index.css',
      });

      if (result) {
        const config = vscode.workspace.getConfiguration(
          'shringarcss-intellisense'
        );
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
