# Code-to-Diagram Generator VS Code Extension

## Overview
The **Code-to-Diagram Generator** is a Visual Studio Code extension that parses JavaScript, Python, and C++ code to generate real-time flowcharts using Abstract Syntax Tree (AST) parsing and **Mermaid.js**.

## Features
- Supports JavaScript (via **Esprima**), Python (via **python-ast**), and C++ (via **cpp-parser**).
- Converts code into a structured **flowchart** for better visualization.
- Automatically detects the language of the open file.
- Displays the generated diagram in a separate **VS Code WebView panel**.

## Installation
1. Clone the repository:
   ```sh
   git clone https://github.com/vaibhavkothari33/Code-to-Diagram.git
   ```
2. Navigate into the project folder:
   ```sh
   cd code-to-diagram
   ```
3. Install dependencies:
   ```sh
   npm install
   ```
4. Open the project in VS Code and press `F5` to launch the extension in a new VS Code window.

## Usage
1. Open a **JavaScript**, **Python**, or **C++** file in VS Code.
2. Run the command **Generate Diagram** from the VS Code command palette (`Ctrl+Shift+P`).
3. The generated flowchart will open in a new preview window.

## Dependencies
Ensure you have the following installed:
- **VS Code**
- **Node.js & npm**
- The following npm packages:
  ```sh
  npm install vscode mermaid esprima python-ast cpp-parser
  ```

## Development
To modify or enhance the extension:
1. Edit `extension.js` to update AST parsing logic.
2. Modify `generateFlowchart()` to customize the diagram structure.
3. Update the WebView `showDiagram()` function to adjust the Mermaid.js rendering.

## License
This project is licensed under the MIT License.

## Contributions
Contributions are welcome! Feel free to fork the repository and submit a pull request.

