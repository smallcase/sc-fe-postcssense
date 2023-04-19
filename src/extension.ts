import * as vscode from 'vscode';
import { CustomCssCompletionProvider } from './customCssCompletionProvider';

export function activate(context: vscode.ExtensionContext) {
  const provider = new CustomCssCompletionProvider();
  const selector: vscode.DocumentSelector = { scheme: 'file', language: 'css' };
  const triggerCharacters = [':'];

  const disposable = vscode.languages.registerCompletionItemProvider(
    selector,
    provider,
    ...triggerCharacters
  );

  context.subscriptions.push(disposable);
}
