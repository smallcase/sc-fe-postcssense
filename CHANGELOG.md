# Change Log

All notable changes to the "PostCSSense" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

### [3.1.2]

- fix issue with setcsspath command not working because of compilation mismatch

### [3.1.1]

- Move Changelog to changelog.md

### [3.1.0]

- Added hover functionality for class names in HTML and JSX/TSX files
- Improved hover detection in template literals and expressions
- Enhanced hover information with formatted CSS properties
- Added support for conditional class expressions in template literals
- Fixed intellisense for complex JSX className patterns with ternary operators
- Fixed CSS resolution for package imports (e.g., `@import "@package-name/style.css"`)
- Added proper node_modules resolution for CSS imports
- Added support for CSS Modules `:global` syntax in local CSS files
- Fixed dynamic updating of CSS classes panel when CSS files change

### [3.0.0]

- Rebranded to `PostCSSense`

### [2.1.0]

- Made the extension completely framework-agnostic
- Added support for regular CSS class selectors and global syntax
- Removed specific framework dependencies
- Added loading indicators for better user experience
- Enhanced class explorer panel with improved syntax highlighting
- Fixed various bugs related to class detection and formatting
- Added hover functionality for class names in HTML and JSX/TSX files
- Improved hover detection in template literals and expressions
- Enhanced hover information with formatted CSS properties

### [2.0.0]

- Support for html, CSS, JSX, TSX files added
- Add Handling to provide custom path
- Add Readme
- Add command to provide custom css path
- **BREAKING CHANGE** - Instead of a hardcoded path now people will have to add path themselves

## [1.0.0]

- Initial release
  - Added intellisense for the global css classes in local css files
