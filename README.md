# PostCSSense

A Visual Studio Code extension that provides intelligent autocompletion for CSS classes in PostCSS files. Get instant class suggestions while working with CSS, HTML, JSX, and TSX files.

## Features

- 🚀 Intelligent autocompletion for CSS
- ✨ Works across multiple file types:
  - CSS files (for `composes: from global`)
  - HTML files (for `class` attributes)
  - JSX/TSX files (for `className` props)
  - JavaScript files with JSX
- 🔧 Configurable CSS path - use any CSS file in your project
- 🎯 Context-aware suggestions
- 🎨 Automatic spacing between multiple classes
- 🔍 Class Explorer panel with search functionality
- 💨 Loading indicators for better user experience
- 🔄 Framework-agnostic - works with any PostCSS project

## Installation

1. Open VS Code
2. Press `Cmd+P` (macOS) or `Ctrl+P` (Windows/Linux)
3. Type `ext install smallcase.postcssense`
4. Press Enter

## Setup

1. Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Type "PostCSSense: Set CSS Path"
3. Enter the path to your main CSS file (relative to workspace root)
   - Example: `src/styles/main.css`

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

### Class Explorer Panel

1. Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Type "PostCSSense: Show CSS Classes"
3. A panel will open showing all CSS classes with their properties
4. Use the search box to filter classes by name

## Configuration

You can configure the extension through VS Code settings:

1. Open Settings (`Cmd+,` / `Ctrl+,`)
2. Search for "PostCSSense"
3. Update the "CSS Path" setting with your preferred path

Alternatively, add this to your `settings.json`:

```json
{
  "postcssense.cssPath": "path/to/your/css/file.css"
}
```

## Requirements

- Visual Studio Code version 1.77.0 or higher
- PostCSS based CSS files in your project

## Known Issues

If you find any issues, please report them [here](https://github.com/smallcase/sc-fe-shringarcss-intellisense/issues).

## Contributing

Contributions are welcome! Feel free to:

1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## Release Notes

### 2.1.0

- Made the extension completely framework-agnostic
- Added support for regular CSS class selectors and global syntax
- Removed specific framework dependencies
- Added loading indicators for better user experience
- Enhanced class explorer panel with improved syntax highlighting
- Fixed various bugs related to class detection and formatting

### 2.0.0

- Support for html, CSS, JSX, TSX files added
- Add Handling to provide custom path
- Add Readme
- Add command to provide custom css path
- **BREAKING CHANGE** - Instead of a hardcoded path now people will have to add path themselves

### 1.0.0

- Initial release
- Support for CSS files
- Context-aware class suggestions

## License

This extension is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
