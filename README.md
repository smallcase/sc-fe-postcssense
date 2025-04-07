# Shringar CSS IntelliSense

A Visual Studio Code extension that provides intelligent autocompletion for `PostCSS` framework classes. Get instant class suggestions while working with CSS, HTML, JSX, and TSX files.

## Features

- 🚀 Intelligent autocompletion for Post CSS global classes
- ✨ Works across multiple file types:
  - CSS files (for `composes: from global`)
  - HTML files (for `class` attributes)
  - JSX/TSX files (for `className` props)
  - JavaScript files with JSX
- 🔧 Configurable CSS path
- 🎯 Context-aware suggestions
- 🎨 Automatic spacing between multiple classes

## Installation

1. Open VS Code
2. Press `Cmd+P` (macOS) or `Ctrl+P` (Windows/Linux)
3. Type `ext install smallcase.shringarcss-intellisense`
4. Press Enter

## Setup

1. Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Type "Shringar CSS: Set CSS Path"
3. Enter the path to your Shringar CSS file (relative to workspace root)
   - Default: `node_modules/@smallcase/shringar/index.css`

## Usage

The extension automatically provides suggestions when you:

### In CSS Files

```css
.your-class {
  composes: /* Suggestions appear here */ from global;
}
```

### In JSX/TSX Files

```jsx
<div className="/* Suggestions appear here */" />
```

### In HTML Files

```html
<div class="/* Suggestions appear here */"></div>
```

### In JavaScript Files with JSX

```javascript
const element = <div className="/* Suggestions appear here */" />;
```

## Configuration

You can configure the extension through VS Code settings:

1. Open Settings (`Cmd+,` / `Ctrl+,`)
2. Search for "Shringar CSS"
3. Update the "CSS Path" setting with your preferred path

Alternatively, add this to your `settings.json`:

```json
{
  "shringarcss-intellisense.cssPath": "path/to/your/css/file.css"
}
```

## Requirements

- Visual Studio Code version 1.77.0 or higher
- Shringar CSS framework installed in your project

## Known Issues

If you find any issues, please report them [here](https://github.com/smallcase/sc-fe-shringarcss-intellisense/issues).

## Contributing

Contributions are welcome! Feel free to:

1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## Release Notes

### 1.0.0

- Initial release
- Support for CSS files
- Context-aware class suggestions

## License

This extension is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
