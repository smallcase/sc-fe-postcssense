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
    const cssClasses = parseCssClasses(await getGlobalCss(document));

    const completionItems = cssClasses
      .filter((cssClass) => classNames.split(' ').indexOf(cssClass) === -1)
      .map((cssClass) => {
        const completionItem = new CompletionItem(
          cssClass,
          CompletionItemKind.Variable
        );
        completionItem.insertText = cssClass;
        return completionItem;
      });

    return completionItems;
  }
}

async function getGlobalCss(document: TextDocument): Promise<string> {
  const rootPath = workspace.getWorkspaceFolder(document.uri)?.uri.fsPath;
  if (!rootPath) {
    throw new Error('Unable to find workspace root path.');
  }

  const cssFilePath = path.join(
    rootPath,
    'node_modules/@smallcase/shringar/index.css'
  );
  const cssContent = await readFile(cssFilePath, 'utf-8');

  const result = await postcss([require('postcss-import')({})]).process(
    cssContent,
    {
      from: cssFilePath,
    }
  );

  const globalCssContent = result.css;
  return globalCssContent;
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

  return cssClasses;
}
