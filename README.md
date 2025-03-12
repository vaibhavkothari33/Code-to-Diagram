# Code to Diagram

A powerful Visual Studio Code extension that generates interactive diagrams from your JavaScript, Python, and C++ code using D3.js visualization.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![VS Code](https://img.shields.io/badge/VS%20Code-1.80+-blue.svg)

[Download the Extension](https://marketplace.visualstudio.com/items?itemName=VaibhavKothari.codesketch)
## Features

- 🎯 **Multi-language Support**: Analyzes JavaScript, TypeScript, Python, and C++ code
- 📊 **Interactive Diagrams**: Dynamic, zoomable D3.js visualizations
- 🎨 **Smart Styling**: Automatic color themes based on VS Code's current theme
- 🔍 **Detailed Information**: Shows class relationships, methods, parameters, and documentation
- ⚡ **Real-time Updates**: Generates diagrams instantly as you code
- 🎭 **Dark/Light Theme Support**: Seamless integration with VS Code themes


<!-- 
## Installation

1. **Clone the Repository**
   ```bash
   git clone https://github.com/vaibhavkothari33/Code-to-Diagram.git
   cd Code-to-Diagram
   ```

2. **Install Dependencies**
   ```bash
   npm install
   pip install -r requirements.txt
   ```

3. **Build the Extension**
   ```bash
   npm run build
   ```

4. **Install in VS Code**
   - Press `F5` to run in development mode, or
   - Generate VSIX file: `vsce package`
   - Install the generated .vsix file in VS Code -->

## Usage

1. Open any supported file (JavaScript, TypeScript, Python, or C++)
2. Open Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
3. Type "codesketch" and select the command
4. View the interactive diagram in the side panel
5. Use the download buttons in the top-right corner to save the diagram as SVG or PNG

<!-- ### Keyboard Shortcuts
- Generate Diagram: `Ctrl+Alt+D` (Windows/Linux) or `Cmd+Alt+D` (Mac)
- Zoom: Mouse wheel or trackpad
- Pan: Click and drag
- Reset View: Double click -->

<!-- ### Export Options
- **SVG Export**: Vector format, perfect for:
  - High-quality printing
  - Further editing in vector graphics software
  - Embedding in documentation
- **PNG Export**: Bitmap format, ideal for:
  - Web usage
  - Presentations
  - Quick sharing
  - Documentation screenshots -->

## Features in Detail

### Class Visualization
- Hierarchical class structure
- Inheritance relationships
- Method and property details
- Parameter types and return values
- Documentation from comments

### Interactive Elements
- Zoom in/out for detail
- Drag nodes to rearrange
- Hover for detailed information
- Click to highlight relationships
- Smooth animations

### Customization
- Automatic theme adaptation
- Configurable colors and styles
- Adjustable layout options
- Custom node grouping

## Requirements

- Visual Studio Code 1.80.0 or higher
- Node.js 14.0 or higher
- Python 3.7 or higher (for Python file analysis)
- npm or yarn

## Extension Settings

This extension contributes the following settings:

- `codeStructure.diagramTheme`: Set the default color theme
- `codeStructure.showDocumentation`: Toggle documentation display
- `codeStructure.layoutDirection`: Set diagram layout direction
- `codeStructure.autoGenerate`: Enable/disable automatic diagram generation

## Known Issues

- Large files may take longer to process
- Some complex template structures in C++ might not be fully represented
- Certain JavaScript decorators may not be properly visualized
<!-- 
## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch
   ```bash
   git checkout -b feature/AmazingFeature
   ```
3. Commit your changes
   ```bash
   git commit -m 'Add some AmazingFeature'
   ```
4. Push to the branch
   ```bash
   git push origin feature/AmazingFeature
   ```
5. Open a Pull Request -->

## Development

### Project Structure
```
code-structure-visualizer/
├── src/
│   ├── extension.js        # Main extension code
│   ├── code_parser.py      # Code parsing logic
│   └── utils/
│       └── constants.js    # Configuration constants
├── test/                   # Test files
├── examples/              # Example code files
└── docs/                 # Documentation
```

### Building
```bash
npm run build
```

### Testing
```bash
npm test
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- D3.js for visualization
- Python AST for Python code parsing
- VS Code Extension API

---

Made with ❤️ by Vaibhav Kothari 