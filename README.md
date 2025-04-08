# PostCSSense

A Visual Studio Code extension that provides intelligent autocompletion for CSS classes in PostCSS files. Get instant class suggestions while working with CSS, HTML, JSX, and TSX files.

## Features

- 🚀 Intelligent autocompletion for CSS classes
- ✨ Works across multiple file types:
  - CSS files (for `composes: from global`)
  - HTML files (for `class` attributes)
  - JSX/TSX files (for `className` props)
  - JavaScript files with JSX
- 🔎 Hover information for CSS classes in:
  - CSS `composes: from global` statements
  - HTML `class` attributes
  - JSX/TSX `className` props
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

The extension provides intelligent features in various file types:

### Autocompletion

#### In CSS Files

```css
.your-class {
  composes: /* Suggestions appear here */ from global;
}
```

#### In JSX/TSX Files

```jsx
<div className="/* Suggestions appear here */" />;

{
  /* Template literals are supported */
}
<div className={`base-class ${isActive ? 'active' : ''}`} />;

{
  /* Conditional classes work too */
}
<div className={`${condition ? 'conditional-class' : ''} always-present`} />;
```

#### In HTML Files

```html
<div class="/* Suggestions appear here */"></div>
```

#### In JavaScript Files with JSX

```javascript
const element = <div className="/* Suggestions appear here */" />;
```

### Hover Information

Hover over class names to see their CSS properties:

#### In CSS Files

```css
.your-class {
  composes: button-primary from global; /* Hover over button-primary */
}
```

#### In JSX/TSX Files

```jsx
<div className="button-primary layout-flex" /> {/* Hover over class names */}
```

#### In HTML Files

```html
<div class="button-primary layout-flex"></div>
<!-- Hover over class names -->
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

### CSS Import Resolution

The extension automatically handles various import formats in your CSS files:

- **Package imports** (from `node_modules`):

  ```css
  @import '@package-name/style.css';
  @import '~package-name/style.css';
  ```

- **Relative imports** (relative to the current file):
  ```css
  @import './components/button.css';
  @import '../styles/variables.css';
  ```

### CSS Global Class Support

The extension supports various syntaxes for global CSS classes:

- **Standard CSS classes**:

  ```css
  .button-primary {
    ...;
  }
  ```

- **Global function syntax**:

  ```css
  .global(button-primary) {
    ...;
  }
  global(.button-primary) {
    ...;
  }
  ```

- **CSS Modules :global syntax**:
  ```css
  :global .button-primary {
    ...;
  }
  :global(.button-primary) {
    ...;
  }
  ```

All these formats are properly recognized for autocompletion and hover information.

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

## License

This extension is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
