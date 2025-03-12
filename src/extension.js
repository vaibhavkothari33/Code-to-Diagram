// // src/extension.js
// const vscode = require('vscode');
// const { spawn } = require('child_process');
// const path = require('path');
// const fs = require('fs');

// /**
//  * @param {vscode.ExtensionContext} context
//  */
// function activate(context) {
//     console.log('Code-to-Diagram extension is now active!');

//     let disposable = vscode.commands.registerCommand('extension.generateDiagram', async function () {
//         const editor = vscode.window.activeTextEditor;
//         if (!editor) {
//             vscode.window.showErrorMessage('No active editor!');
//             return;
//         }
        
//         const language = editor.document.languageId;
//         const code = editor.document.getText();
        
//         console.log(`Detected Language: ${language}`);
//         console.log(`Code length: ${code.length} characters`);
        
//         if (!language) {
//             vscode.window.showErrorMessage("Unable to detect language");
//             return;
//         }
        
//         if (!code) {
//             vscode.window.showErrorMessage('No code detected in the editor!');
//             return;
//         }

//         // Check for supported languages
//         const supportedLanguages = ['python', 'javascript', 'typescript'];
//         if (!supportedLanguages.includes(language)) {
//             vscode.window.showWarningMessage(`Language '${language}' is not fully supported yet. Basic diagram will be generated.`);
//         }

//         // Check if Python is installed
//         try {
//             await checkPythonInstallation();
//         } catch (error) {
//             vscode.window.showErrorMessage(`Python is required: ${error.message}`);
//             return;
//         }

//         // Create temp directory if it doesn't exist
//         const tempDir = path.join(context.extensionPath, 'temp');
//         if (!fs.existsSync(tempDir)) {
//             fs.mkdirSync(tempDir);
//         }

//         // Save the parser script to disk
//         const parserPath = path.join(tempDir, 'parser.py');
//         fs.writeFileSync(parserPath, getPythonParserScript());

//         // Run the Python parser
//         const pythonProcess = spawn('python', [parserPath, language]);
//         let output = '';
//         let errorOutput = '';

//         pythonProcess.stdin.write(code);
//         pythonProcess.stdin.end();

//         pythonProcess.stdout.on('data', (data) => {
//             output += data.toString();
//         });

//         pythonProcess.stderr.on('data', (data) => {
//             errorOutput += data.toString();
//         });

//         pythonProcess.on('close', (code) => {
//             if (code !== 0) {
//                 vscode.window.showErrorMessage(`Parser exited with code ${code}: ${errorOutput}`);
//                 return;
//             }

//             try {
//                 const result = JSON.parse(output);
//                 if (result.error) {
//                     vscode.window.showErrorMessage(`Parser error: ${result.error}`);
//                 } else {
//                     showDiagram(result.diagram);
//                 }
//             } catch (error) {
//                 vscode.window.showErrorMessage(`Failed to parse output: ${error.message}`);
//                 console.error('Raw output:', output);
//             }
//         });
//     });

//     context.subscriptions.push(disposable);
// }

// async function checkPythonInstallation() {
//     return new Promise((resolve, reject) => {
//         const process = spawn('python', ['--version']);
        
//         process.on('close', (code) => {
//             if (code === 0) {
//                 resolve();
//             } else {
//                 reject(new Error('Python is not installed or not in PATH'));
//             }
//         });
//     });
// }

// function getPythonParserScript() {
//     return `
// import ast
// import json
// import sys

// def traverse(node, parent_id=None, nodes=None, edges=None, node_counter=None):
//     if nodes is None:
//         nodes = []
//     if edges is None:
//         edges = []
//     if node_counter is None:
//         node_counter = [0]

//     node_id = f"node{node_counter[0]}"
//     node_counter[0] += 1
    
//     # Add more details based on node type
//     label = type(node).__name__
//     if isinstance(node, ast.FunctionDef):
//         label = f"Function: {node.name}"
//     elif isinstance(node, ast.ClassDef):
//         label = f"Class: {node.name}"
//     elif isinstance(node, ast.If):
//         label = "If condition"
//     elif isinstance(node, ast.For):
//         label = "For loop"
//     elif isinstance(node, ast.While):
//         label = "While loop"
//     elif isinstance(node, ast.Import):
//         names = ", ".join([n.name for n in node.names])
//         label = f"Import: {names}"
    
//     nodes.append(f'{node_id}["{label}"]')

//     if parent_id:
//         edges.append(f"{parent_id} --> {node_id}")

//     for child in ast.iter_child_nodes(node):
//         traverse(child, node_id, nodes, edges, node_counter)

//     return nodes, edges

// def generate_flowchart_python(code):
//     try:
//         tree = ast.parse(code)
//         nodes, edges = traverse(tree)
//         diagram = "graph TD;\\n" + "\\n".join(nodes) + "\\n" + "\\n".join(edges)
//         return diagram
//     except Exception as e:
//         return f"Error parsing Python code: {str(e)}"

// def generate_generic_flowchart(code, language):
//     # Very simplified generic parser that just identifies functions and classes
//     # based on common patterns
//     nodes = []
//     edges = []
//     node_counter = 0
    
//     # Create a root node
//     root_id = f"node{node_counter}"
//     nodes.append(f'{root_id}["Root: {language} code"]')
//     node_counter += 1
    
//     lines = code.split('\\n')
//     current_parent = root_id
    
//     for line in lines:
//         line = line.strip()
//         # Very basic pattern matching - this should be improved
//         if language in ['javascript', 'typescript'] and ('function ' in line or '=>' in line):
//             # Extract function name with simple regex-like approach
//             if 'function ' in line:
//                 func_name = line.split('function ')[1].split('(')[0].strip()
//             else:
//                 parts = line.split('=')
//                 if len(parts) > 1:
//                     func_name = parts[0].strip()
//                 else:
//                     func_name = "anonymous"
            
//             node_id = f"node{node_counter}"
//             nodes.append(f'{node_id}["Function: {func_name}"]')
//             edges.append(f"{current_parent} --> {node_id}")
//             node_counter += 1
            
//         elif language in ['javascript', 'typescript'] and 'class ' in line:
//             class_name = line.split('class ')[1].split('{')[0].split('extends')[0].strip()
//             node_id = f"node{node_counter}"
//             nodes.append(f'{node_id}["Class: {class_name}"]')
//             edges.append(f"{root_id} --> {node_id}")
//             current_parent = node_id
//             node_counter += 1
    
//     diagram = "graph TD;\\n" + "\\n".join(nodes) + "\\n" + "\\n".join(edges)
//     return diagram

// if __name__ == "__main__":
//     # Check if a language argument is passed
//     if len(sys.argv) < 2:
//         print(json.dumps({"error": "No language provided"}))
//         sys.exit(1)

//     language = sys.argv[1]  
//     input_code = sys.stdin.read()

//     if not input_code:
//         print(json.dumps({"error": "No code provided"}))
//         sys.exit(1)

//     if language == "python":
//         flowchart = generate_flowchart_python(input_code)
//     else:
//         # For other languages, use a generic approach
//         flowchart = generate_generic_flowchart(input_code, language)

//     print(json.dumps({"diagram": flowchart}))
// `
// }

// function showDiagram(diagram) {
//     const panel = vscode.window.createWebviewPanel(
//         'diagramPreview',
//         'Code Diagram',
//         vscode.ViewColumn.Two,
//         {
//             enableScripts: true
//         }
//     );
    
//     panel.webview.html = `
//         <!DOCTYPE html>
//         <html>
//         <head>
//             <meta charset="UTF-8">
//             <meta name="viewport" content="width=device-width, initial-scale=1.0">
//             <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
//             <style>
//                 body {
//                     font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
//                     padding: 20px;
//                 }
//                 .container {
//                     max-width: 100%;
//                     overflow: auto;
//                 }
//                 .diagram-controls {
//                     margin-bottom: 20px;
//                 }
//                 button {
//                     padding: 6px 12px;
//                     background-color: #0078D4;
//                     color: white;
//                     border: none;
//                     border-radius: 2px;
//                     cursor: pointer;
//                     margin-right: 10px;
//                 }
//                 button:hover {
//                     background-color: #106EBE;
//                 }
//             </style>
//         </head>
//         <body>
//             <div class="diagram-controls">
//                 <button id="zoomIn">Zoom In</button>
//                 <button id="zoomOut">Zoom Out</button>
//                 <button id="resetZoom">Reset Zoom</button>
//             </div>
//             <div class="container">
//                 <div class="mermaid">${diagram}</div>
//             </div>
//             <script>
//                 mermaid.initialize({
//                     startOnLoad: true,
//                     theme: 'default',
//                     securityLevel: 'loose'
//                 });
                
//                 // Add zoom functionality
//                 let scale = 1;
//                 const container = document.querySelector('.container');
                
//                 document.getElementById('zoomIn').addEventListener('click', () => {
//                     scale += 0.1;
//                     container.style.transform = \`scale(\${scale})\`;
//                 });
                
//                 document.getElementById('zoomOut').addEventListener('click', () => {
//                     if (scale > 0.5) {
//                         scale -= 0.1;
//                         container.style.transform = \`scale(\${scale})\`;
//                     }
//                 });
                
//                 document.getElementById('resetZoom').addEventListener('click', () => {
//                     scale = 1;
//                     container.style.transform = 'scale(1)';
//                 });
//             </script>
//         </body>
//         </html>
//     `;
// }

// function deactivate() {}

// module.exports = {
//     activate,
//     deactivate
// }








const vscode = require('vscode');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log('Code-to-Diagram extension is now active!');

    let disposable = vscode.commands.registerCommand('extension.generateDiagram', async function () {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor!');
            return;
        }
        
        const language = editor.document.languageId;
        const code = editor.document.getText();
        
        console.log(`Detected Language: ${language}`);
        console.log(`Code length: ${code.length} characters`);
        
        if (!language) {
            vscode.window.showErrorMessage("Unable to detect language");
            return;
        }
        
        if (!code) {
            vscode.window.showErrorMessage('No code detected in the editor!');
            return;
        }

        // Start loading indicator
        const loadingStatus = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        loadingStatus.text = "$(sync~spin) Generating diagram...";
        loadingStatus.show();

        // Check for supported languages
        const supportedLanguages = ['python', 'javascript', 'typescript', 'cpp', 'c'];
        if (!supportedLanguages.includes(language)) {
            vscode.window.showWarningMessage(`Language '${language}' is not fully supported yet. Basic diagram will be generated.`);
        }

        // Check if Python is installed
        try {
            await checkPythonInstallation();
        } catch (error) {
            loadingStatus.dispose();
            vscode.window.showErrorMessage(`Python is required: ${error.message}`);
            return;
        }

        // Create temp directory if it doesn't exist
        const tempDir = path.join(context.extensionPath, 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir);
        }

        // Save the parser script to disk
        const parserPath = path.join(tempDir, 'parser.py');
        fs.writeFileSync(parserPath, getPythonParserScript());

        // Run the Python parser
        const pythonProcess = spawn('python', [parserPath, language]);
        let output = '';
        let errorOutput = '';

        pythonProcess.stdin.write(code);
        pythonProcess.stdin.end();

        pythonProcess.stdout.on('data', (data) => {
            output += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        pythonProcess.on('close', (code) => {
            loadingStatus.dispose();
            
            if (code !== 0) {
                vscode.window.showErrorMessage(`Parser exited with code ${code}: ${errorOutput}`);
                return;
            }

            try {
                const result = JSON.parse(output);
                if (result.error) {
                    vscode.window.showErrorMessage(`Parser error: ${result.error}`);
                } else {
                    showDiagram(result.diagram, language);
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to parse output: ${error.message}`);
                console.error('Raw output:', output);
            }
        });
    });

    context.subscriptions.push(disposable);
}

async function checkPythonInstallation() {
    return new Promise((resolve, reject) => {
        const process = spawn('python', ['--version']);
        
        process.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error('Python is not installed or not in PATH'));
            }
        });
    });
}

function getPythonParserScript() {
    return `
import ast
import json
import sys
import re

def traverse(node, parent_id=None, nodes=None, edges=None, node_counter=None, depth=0):
    if nodes is None:
        nodes = []
    if edges is None:
        edges = []
    if node_counter is None:
        node_counter = [0]

    node_id = f"node{node_counter[0]}"
    node_counter[0] += 1
    
    # Add more details based on node type
    label = type(node).__name__
    style = ""
    
    if isinstance(node, ast.FunctionDef):
        label = f"Function: {node.name}"
        style = "fill:#a2d8f2,stroke:#4a90b8"
    elif isinstance(node, ast.ClassDef):
        label = f"Class: {node.name}"
        style = "fill:#d9f7be,stroke:#52c41a"
    elif isinstance(node, ast.If):
        label = "If condition"
        style = "fill:#ffd6e7,stroke:#eb2f96"
    elif isinstance(node, ast.For):
        label = "For loop"
        style = "fill:#fff1b8,stroke:#faad14"
    elif isinstance(node, ast.While):
        label = "While loop"
        style = "fill:#ffe7ba,stroke:#fa8c16"
    elif isinstance(node, ast.Import) or isinstance(node, ast.ImportFrom):
        if isinstance(node, ast.Import):
            names = ", ".join([n.name for n in node.names])
        else:
            module = node.module or ""
            names = ", ".join([f"{module}.{n.name}" for n in node.names])
        label = f"Import: {names}"
        style = "fill:#d9d9d9,stroke:#8c8c8c"
    elif isinstance(node, ast.Return):
        label = "Return statement"
        style = "fill:#ffa39e,stroke:#f5222d"
    elif isinstance(node, ast.Try):
        label = "Try block"
        style = "fill:#d3adf7,stroke:#722ed1"
    elif isinstance(node, ast.Except):
        label = "Except handler"
        style = "fill:#ffadd2,stroke:#eb2f96"
    
    if style:
        nodes.append(f'{node_id}["{label}"]:::custom{node_counter[0]}')
        nodes.append(f'classDef custom{node_counter[0]} {style}')
    else:
        nodes.append(f'{node_id}["{label}"]')

    if parent_id:
        edges.append(f"{parent_id} --> {node_id}")

    # Process only important child nodes to avoid diagram clutter
    important_children = [
        child for child in ast.iter_child_nodes(node)
        if isinstance(child, (ast.FunctionDef, ast.ClassDef, ast.If, 
                             ast.For, ast.While, ast.Import, ast.ImportFrom, 
                             ast.Try, ast.Return))
    ]
    
    # If there are no important children but there are other children,
    # process some of them to show structure
    if not important_children:
        # Limit to first few children to prevent overwhelming diagrams
        for i, child in enumerate(list(ast.iter_child_nodes(node))[:3]):
            if depth < 5:  # Limit depth to prevent excessive nesting
                traverse(child, node_id, nodes, edges, node_counter, depth + 1)
    else:
        for child in important_children:
            if depth < 5:  # Limit depth to prevent excessive nesting
                traverse(child, node_id, nodes, edges, node_counter, depth + 1)

    return nodes, edges

def generate_flowchart_python(code):
    try:
        tree = ast.parse(code)
        nodes, edges = traverse(tree)
        
        # Create Mermaid diagram with improved layout settings
        diagram = "graph TD;\\n"
        diagram += "%%{ init: { 'flowchart': { 'curve': 'basis', 'nodeSpacing': 50, 'rankSpacing': 70 } } }%%\\n"
        diagram += "\\n".join(nodes) + "\\n" + "\\n".join(edges)
        
        return diagram
    except Exception as e:
        return f"Error parsing Python code: {str(e)}"

def parse_javascript_typescript(code, language):
    """Improved JavaScript/TypeScript parser using regex patterns"""
    nodes = []
    edges = []
    node_counter = 0
    
    # Create a root node
    root_id = f"node{node_counter}"
    nodes.append(f'{root_id}["Root: {language} code"]:::rootNode')
    nodes.append(f'classDef rootNode fill:#f5f5f5,stroke:#d9d9d9,stroke-width:2px')
    node_counter += 1
    
    # Find class definitions
    class_pattern = r'class\s+(\w+)(?:\s+extends\s+(\w+))?'
    for match in re.finditer(class_pattern, code):
        class_name = match.group(1)
        parent_class = match.group(2)
        
        node_id = f"node{node_counter}"
        if parent_class:
            label = f"Class: {class_name}\\nextends {parent_class}"
        else:
            label = f"Class: {class_name}"
        
        nodes.append(f'{node_id}["{label}"]:::classNode')
        edges.append(f"{root_id} --> {node_id}")
        node_counter += 1
        
        # Find methods within this class
        # Get the class body by finding the matching closing brace
        class_start = match.end()
        brace_count = 0
        found_first_brace = False
        class_end = class_start
        
        for i in range(class_start, len(code)):
            if code[i] == '{':
                if not found_first_brace:
                    found_first_brace = True
                brace_count += 1
            elif code[i] == '}':
                brace_count -= 1
                if found_first_brace and brace_count == 0:
                    class_end = i
                    break
        
        class_body = code[class_start:class_end]
        
        # Find methods in the class body
        method_pattern = r'(?:async\s+)?(?:static\s+)?(?:get|set)?\s*(\w+)\s*\([^)]*\)\s*{|(?:async\s+)?(\w+)\s*=\s*(?:\([^)]*\)|async\s*\([^)]*\))\s*=>'
        for method_match in re.finditer(method_pattern, class_body):
            method_name = method_match.group(1) or method_match.group(2)
            if method_name and method_name not in ['constructor', 'if', 'for', 'while', 'switch']:
                method_id = f"node{node_counter}"
                nodes.append(f'{method_id}["Method: {method_name}"]:::methodNode')
                edges.append(f"{node_id} --> {method_id}")
                node_counter += 1
    
    # Find standalone functions
    function_patterns = [
        r'function\s+(\w+)\s*\([^)]*\)',  # Normal function declaration
        r'const\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>',  # Arrow function with parameters
        r'const\s+(\w+)\s*=\s*(?:async\s*)?\s*function\s*\([^)]*\)'  # Function expression
    ]
    
    for pattern in function_patterns:
        for match in re.finditer(pattern, code):
            func_name = match.group(1)
            if func_name:
                node_id = f"node{node_counter}"
                nodes.append(f'{node_id}["Function: {func_name}"]:::functionNode')
                edges.append(f"{root_id} --> {node_id}")
                node_counter += 1
    
    # Add styling for nodes
    nodes.append('classDef classNode fill:#d9f7be,stroke:#52c41a,stroke-width:2px')
    nodes.append('classDef methodNode fill:#bae7ff,stroke:#1890ff,stroke-width:1px')
    nodes.append('classDef functionNode fill:#a2d8f2,stroke:#4a90b8,stroke-width:1.5px')
    
    # Create Mermaid diagram with improved layout settings
    diagram = "graph TD;\\n"
    diagram += "%%{ init: { 'flowchart': { 'curve': 'basis', 'nodeSpacing': 50, 'rankSpacing': 60 } } }%%\\n"
    diagram += "\\n".join(nodes) + "\\n" + "\\n".join(edges)
    
    return diagram

def parse_cpp(code):
    """Basic C++ parser using regex patterns"""
    nodes = []
    edges = []
    node_counter = 0
    
    # Create a root node
    root_id = f"node{node_counter}"
    nodes.append(f'{root_id}["Root: C++ code"]:::rootNode')
    nodes.append(f'classDef rootNode fill:#f5f5f5,stroke:#d9d9d9,stroke-width:2px')
    node_counter += 1
    
    # Find class definitions
    class_pattern = r'class\s+(\w+)(?:\s*:\s*(?:public|private|protected)\s+(\w+))?'
    for match in re.finditer(class_pattern, code):
        class_name = match.group(1)
        parent_class = match.group(2)
        
        node_id = f"node{node_counter}"
        if parent_class:
            label = f"Class: {class_name}\\ninherits {parent_class}"
        else:
            label = f"Class: {class_name}"
        
        nodes.append(f'{node_id}["{label}"]:::classNode')
        edges.append(f"{root_id} --> {node_id}")
        node_counter += 1
    
    # Find standalone functions (simplified)
    function_pattern = r'(?:static|inline|virtual|explicit|)?\s*(?:const|volatile|)?\s*(?:\w+(?:::\w+)*(?:<[^>]*>)?&*\s+)(\w+)\s*\([^{;]*\)\s*(?:const|noexcept|override|final|)?\s*(?:=\s*(?:default|delete|0)|)'
    for match in re.finditer(function_pattern, code):
        func_name = match.group(1)
        if func_name and not func_name in ['if', 'for', 'while', 'switch']:
            node_id = f"node{node_counter}"
            nodes.append(f'{node_id}["Function: {func_name}"]:::functionNode')
            edges.append(f"{root_id} --> {node_id}")
            node_counter += 1
    
    # Add styling for nodes
    nodes.append('classDef classNode fill:#d9f7be,stroke:#52c41a,stroke-width:2px')
    nodes.append('classDef functionNode fill:#a2d8f2,stroke:#4a90b8,stroke-width:1.5px')
    
    # Create Mermaid diagram with improved layout settings
    diagram = "graph TD;\\n"
    diagram += "%%{ init: { 'flowchart': { 'curve': 'basis', 'nodeSpacing': 50, 'rankSpacing': 60 } } }%%\\n"
    diagram += "\\n".join(nodes) + "\\n" + "\\n".join(edges)
    
    return diagram

if __name__ == "__main__":
    # Check if a language argument is passed
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No language provided"}))
        sys.exit(1)

    language = sys.argv[1]  
    input_code = sys.stdin.read()

    if not input_code:
        print(json.dumps({"error": "No code provided"}))
        sys.exit(1)

    if language == "python":
        flowchart = generate_flowchart_python(input_code)
    elif language in ["javascript", "typescript"]:
        flowchart = parse_javascript_typescript(input_code, language)
    elif language in ["cpp", "c"]:
        flowchart = parse_cpp(input_code)
    else:
        # For other languages, use a generic approach
        flowchart = parse_javascript_typescript(input_code, language)  # Use JS parser as fallback

    print(json.dumps({"diagram": flowchart}))
`
}

function showDiagram(diagram, language) {
    // Get current theme
    const isDarkTheme = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark;

    const panel = vscode.window.createWebviewPanel(
        'diagramPreview',
        `Code Diagram: ${language.toUpperCase()}`,
        vscode.ViewColumn.Two,
        {
            enableScripts: true,
            retainContextWhenHidden: true
        }
    );
    
    panel.webview.html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <script src="https://cdn.jsdelivr.net/npm/mermaid@10.3.1/dist/mermaid.min.js"></script>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js"></script>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                    padding: 20px;
                    margin: 0;
                    height: 100vh;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    background-color: ${isDarkTheme ? '#1e1e1e' : '#ffffff'};
                    color: ${isDarkTheme ? '#d4d4d4' : '#333333'};
                }
                .toolbar {
                    display: flex;
                    gap: 10px;
                    padding: 10px;
                    background-color: ${isDarkTheme ? '#252525' : '#f3f3f3'};
                    border-bottom: 1px solid ${isDarkTheme ? '#333' : '#ddd'};
                    align-items: center;
                    flex-wrap: wrap;
                }
                .toolbar-group {
                    display: flex;
                    gap: 5px;
                    align-items: center;
                    margin-right: 15px;
                }
                .toolbar-label {
                    font-size: 12px;
                    color: ${isDarkTheme ? '#cccccc' : '#666666'};
                }
               .container {
                    flex: 1;
                    overflow: hidden;
                    position: relative;
                }
                .diagram-container {
                    position: absolute;
                    top: 0;
                    left: 0;
                    transform-origin: 0 0;
                    background-color: ${isDarkTheme ? '#1e1e1e' : '#ffffff'};
                    padding: 20px;
                    overflow: visible;
                }
                button, select {
                    padding: 6px 12px;
                    background-color: ${isDarkTheme ? '#0e639c' : '#0078D4'};
                    color: white;
                    border: none;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 13px;
                }
                button:hover {
                    background-color: ${isDarkTheme ? '#1177bb' : '#106EBE'};
                }
                button:active {
                    background-color: ${isDarkTheme ? '#0d5c8f' : '#005a9e'};
                }
                button.secondary {
                    background-color: ${isDarkTheme ? '#3a3d41' : '#f3f3f3'};
                    color: ${isDarkTheme ? '#ffffff' : '#333333'};
                    border: 1px solid ${isDarkTheme ? '#3a3d41' : '#d4d4d4'};
                }
                button.secondary:hover {
                    background-color: ${isDarkTheme ? '#45494e' : '#e6e6e6'};
                }
                .status-bar {
                    padding: 5px 10px;
                    font-size: 12px;
                    background-color: ${isDarkTheme ? '#007acc' : '#0078D4'};
                    color: white;
                    display: flex;
                    justify-content: space-between;
                }
                .slider-container {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                }
                input[type="range"] {
                    width: 100px;
                }
                .slider-value {
                    width: 40px;
                    text-align: center;
                    font-size: 12px;
                }
                select {
                    background-color: ${isDarkTheme ? '#3a3d41' : '#f3f3f3'};
                    color: ${isDarkTheme ? '#ffffff' : '#333333'};
                }
                .fullscreen {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background-color: ${isDarkTheme ? '#1e1e1e' : '#ffffff'};
                    z-index: 9999;
                }
                .loading {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                }
                .loading-spinner {
                    border: 4px solid rgba(0, 0, 0, 0.1);
                    border-radius: 50%;
                    border-left: 4px solid ${isDarkTheme ? '#0e639c' : '#0078D4'};
                    width: 40px;
                    height: 40px;
                    animation: spin 1s linear infinite;
                    margin-bottom: 10px;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        </head>
        <body>
            <div class="toolbar">
                <div class="toolbar-group">
                    <button id="zoomIn" title="Zoom In">Zoom In</button>
                    <button id="zoomOut" title="Zoom Out">Zoom Out</button>
                    <button id="resetZoom" title="Reset Zoom">Reset Zoom</button>
                    <button id="fitContent" title="Fit to View">Fit to View</button>
                </div>
                <div class="toolbar-group">
                    <div class="slider-container">
                        <span class="toolbar-label">Zoom:</span>
                        <input type="range" id="zoomSlider" min="10" max="200" value="100">
                        <span id="zoomPercentage" class="slider-value">100%</span>
                    </div>
                </div>
                <div class="toolbar-group">
                    <button id="toggleTheme" class="secondary" title="Toggle Light/Dark Theme">Toggle Theme</button>
                    <button id="toggleFullscreen" class="secondary" title="Toggle Fullscreen">Fullscreen</button>
                </div>
                <div class="toolbar-group">
                    <span class="toolbar-label">Export:</span>
                    <button id="exportSVG" title="Export as SVG">SVG</button>
                    <button id="exportPNG" title="Export as PNG">PNG</button>
                    <button id="copyToClipboard" title="Copy to Clipboard">Copy</button>
                </div>
                <div class="toolbar-group">
                    <span class="toolbar-label">Layout:</span>
                    <select id="layoutDirection">
                        <option value="TD">Top Down</option>
                        <option value="TB">Top Down (alt)</option>
                        <option value="BT">Bottom Up</option>
                        <option value="RL">Right to Left</option>
                        <option value="LR">Left to Right</option>
                    </select>
                </div>
            </div>
            
            <div class="container" id="diagramContainer">
                <div id="loading" class="loading">
                    <div class="loading-spinner"></div>
                    <div>Rendering diagram...</div>
                </div>
                <div class="diagram-container" id="diagramContent">
                    <div class="mermaid">${diagram}</div>
                </div>
            </div>
            
            <div class="status-bar">
                <div id="statusInfo">Ready</div>
                <div id="coordinates">X: 0, Y: 0</div>
            </div>
            
            <script>
                // Initialize Mermaid with theme based on VS Code theme
                mermaid.initialize({
                    startOnLoad: true,
                    theme: '${isDarkTheme ? 'dark' : 'default'}',
                    flowchart: {
                        useMaxWidth: false,
                        htmlLabels: true,
                        curve: 'basis'
                    },
                    securityLevel: 'loose'
                });
                
                // Variables for pan and zoom
                let scale = 1;
                let panX = 0;
                let panY = 0;
                let isPanning = false;
                let startX = 0;
                let startY = 0;
                let isFullscreen = false;
                let currentTheme = '${isDarkTheme ? 'dark' : 'default'}';
                
                const container = document.getElementById('diagramContainer');
                const content = document.getElementById('diagramContent');
                const zoomSlider = document.getElementById('zoomSlider');
                const zoomPercentage = document.getElementById('zoomPercentage');
                const coordinates = document.getElementById('coordinates');
                const statusInfo = document.getElementById('statusInfo');
                const loadingIndicator = document.getElementById('loading');
                
                // Immediately hide loading when mermaid is done
                window.addEventListener('load', () => {
                    // Give mermaid time to render
                    setTimeout(() => {
                        loadingIndicator.style.display = 'none';
                        fitContent();
                    }, 500);
                });
                
                // Apply transform to the content
                function updateTransform() {
                    content.style.transform = \`translate(\${panX}px, \${panY}px) scale(\${scale})\`;
                    zoomSlider.value = scale * 100;
                    zoomPercentage.textContent = \`\${Math.round(scale * 100)}%\`;
                }
                
                // Zoom functions
                document.getElementById('zoomIn').addEventListener('click', () => {
                    scale = Math.min(scale * 1.2, 5);
                    updateTransform();
                });
                
                document.getElementById('zoomOut').addEventListener('click', () => {
                    scale = Math.max(scale / 1.2, 0.1);
                    updateTransform();
                });
                
                document.getElementById('resetZoom').addEventListener('click', () => {
                    scale = 1;
                    panX = 0;
                    panY = 0;
                    updateTransform();
                });
                
                document.getElementById('fitContent').addEventListener('click', fitContent);
                
                // Fit content function
                function fitContent() {
                    // Wait for mermaid to finish rendering
                    setTimeout(() => {
                        const svg = content.querySelector('svg');
                        if (!svg) return;
                        
                        const svgWidth = svg.getBoundingClientRect().width;
                        const svgHeight = svg.getBoundingClientRect().height;
                        const containerWidth = container.clientWidth;
                        const containerHeight = container.clientHeight;
                        
                        // Calculate scale to fit
                        const scaleX = containerWidth / svgWidth;
                        const scaleY = containerHeight / svgHeight;
                        scale = Math.min(scaleX, scaleY) * 0.9; // 90% to add some padding
                        
                        // Center content
                        panX = (containerWidth - svgWidth * scale) / 2;
                        panY = (containerHeight - svgHeight * scale) / 2;
                        
                        updateTransform();
                        statusInfo.textContent = 'Diagram fitted to view';
                    }, 100);
                }
                
                // Mouse wheel zoom
                container.addEventListener('wheel', (e) => {
                    e.preventDefault();
                    
                    // Get the cursor position relative to the container
                    const rect = container.getBoundingClientRect();
                    const mouseX = e.clientX - rect.left;
                    const mouseY = e.clientY - rect.top;
                    
                    // Calculate position in the scaled/panned content
                    const contentX = (mouseX - panX) / scale;
                    const contentY = (mouseY - panY) / scale;
                    
                    // Zoom
                    const delta = e.deltaY > 0 ? 0.9 : 1.1;
                    const newScale = Math.max(0.1, Math.min(5, scale * delta));
                    
                    // Calculate new pan position to zoom toward cursor
                    if (scale !== newScale) {
                        panX = mouseX - contentX * newScale;
                        panY = mouseY - contentY * newScale;
                        scale = newScale;
                        updateTransform();
                    }
                });
                
                // Pan functionality
                container.addEventListener('mousedown', (e) => {
                    if (e.button === 0) { // Left mouse button
                        isPanning = true;
                        startX = e.clientX - panX;
                        startY = e.clientY - panY;
                        container.style.cursor = 'grabbing';
                    }
                });
                
                window.addEventListener('mousemove', (e) => {
                    // Update coordinates in status bar
                    const rect = container.getBoundingClientRect();
                    if (e.clientX >= rect.left && e.clientX <= rect.right && 
                        e.clientY >= rect.top && e.clientY <= rect.bottom) {
                        coordinates.textContent = \`X: \${Math.round((e.clientX - rect.left - panX) / scale)}, Y: \${Math.round((e.clientY - rect.top - panY) / scale)}\`;
                    }
                    
                    if (isPanning) {
                        panX = e.clientX - startX;
                        panY = e.clientY - startY;
                        updateTransform();
                    }
                });
                
                window.addEventListener('mouseup', () => {
                    if (isPanning) {
                        isPanning = false;
                        container.style.cursor = 'default';
                    }
                });
                
                // Zoom slider
                zoomSlider.addEventListener('input', () => {
                    scale = zoomSlider.value / 100;
                    updateTransform();
                });
                
                // Layout direction selector
                document.getElementById('layoutDirection').addEventListener('change', (e) => {
                    const direction = e.target.value;
                    const mermaidDiv = document.querySelector('.mermaid');
                    let diagramText = mermaidDiv.textContent;
                    
                    // Replace direction in the diagram
                    diagramText = diagramText.replace(/graph [A-Z]{2};/, \`graph \${direction};\`);
                    mermaidDiv.textContent = diagramText;
                    
                    // Re-render
                    loadingIndicator.style.display = 'flex';
                    mermaid.init(undefined, '.mermaid');
                    
                    setTimeout(() => {
                        loadingIndicator.style.display = 'none';
                        statusInfo.textContent = \`Layout direction changed to \${direction}\`;
                    }, 500);
                });
                
                // Theme toggle
                document.getElementById('toggleTheme').addEventListener('click', () => {
                    currentTheme = currentTheme === 'default' ? 'dark' : 'default';
                    
                    // Update mermaid config
                    mermaid.initialize({
                        theme: currentTheme
                    });
                    
                    // Re-render
                    loadingIndicator.style.display = 'flex';
                    const mermaidDiv = document.querySelector('.mermaid');
                    mermaid.mermaidAPI.render('mermaid-svg', mermaidDiv.textContent, (svgCode) => {
                        mermaidDiv.innerHTML = svgCode;
                        loadingIndicator.style.display = 'none';
                        statusInfo.textContent = \`Theme changed to \${currentTheme}\`;
                    });
                });
                
                // Fullscreen toggle
                document.getElementById('toggleFullscreen').addEventListener('click', () => {
                    isFullscreen = !isFullscreen;
                    
                    if (isFullscreen) {
                        document.body.classList.add('fullscreen');
                        document.getElementById('toggleFullscreen').textContent = 'Exit Fullscreen';
                    } else {
                        document.body.classList.remove('fullscreen');
                        document.getElementById('toggleFullscreen').textContent = 'Fullscreen';
                    }
                    
                    // Adjust layout
                    setTimeout(fitContent, 100);
                });
                
                // Export as SVG
                    document.getElementById('exportSVG').addEventListener('click', () => {
                        const svg = content.querySelector('svg');
                        if (!svg) {
                            statusInfo.textContent = 'No SVG found to export';
                            return;
                        }
                        
                        // Clone the SVG to modify it
                        const svgClone = svg.cloneNode(true);
                        
                        // Make sure all necessary styles are inlined
                        const svgData = new XMLSerializer().serializeToString(svgClone);
                        const blob = new Blob([svgData], {type: 'image/svg+xml'});
                        saveAs(blob, 'code-diagram.svg');
                        
                        statusInfo.textContent = 'Exported as SVG';
                    });
                    
                    // Export as PNG
                    document.getElementById('exportPNG').addEventListener('click', () => {
                        const svgElement = content.querySelector('svg');
                        if (!svgElement) {
                            statusInfo.textContent = 'No diagram found to export';
                            return;
                        }
                        
                        statusInfo.textContent = 'Generating PNG...';
                        
                        // Set a white background for the SVG for export
                        const originalBg = svgElement.style.backgroundColor;
                        svgElement.style.backgroundColor = 'white';
                        
                        html2canvas(svgElement, {
                            backgroundColor: 'white',
                            scale: 2 // Higher quality
                        }).then(canvas => {
                            // Reset SVG background
                            svgElement.style.backgroundColor = originalBg;
                            
                            canvas.toBlob(blob => {
                                saveAs(blob, 'code-diagram.png');
                                statusInfo.textContent = 'Exported as PNG';
                            });
                        }).catch(err => {
                            svgElement.style.backgroundColor = originalBg;
                            statusInfo.textContent = 'PNG export failed: ' + err.message;
                        });
                    });
                    
                    // Copy to clipboard
                    document.getElementById('copyToClipboard').addEventListener('click', () => {
                        const svg = content.querySelector('svg');
                        if (!svg) {
                            statusInfo.textContent = 'No diagram found to copy';
                            return;
                        }
                        
                        // Create a canvas
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        
                        // Set canvas dimensions
                        const rect = svg.getBoundingClientRect();
                        canvas.width = rect.width * 2;  // Higher resolution
                        canvas.height = rect.height * 2;
                        
                        // Draw svg on canvas
                        const data = new XMLSerializer().serializeToString(svg);
                        const img = new Image();
                        
                        img.onload = function() {
                            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                            canvas.toBlob(blob => {
                                // Use clipboard API if available
                                try {
                                    navigator.clipboard.write([
                                        new ClipboardItem({'image/png': blob})
                                    ]).then(() => {
                                        statusInfo.textContent = 'Copied to clipboard';
                                    }).catch(err => {
                                        statusInfo.textContent = 'Failed to copy: ' + err.message;
                                    });
                                } catch (e) {
                                    statusInfo.textContent = 'Clipboard API not supported';
                                }
                            });
                        };
                        
                        img.src = 'data:image/svg+xml;base64,' + btoa(data);
                    });
                    
                    // Keyboard shortcuts
                    window.addEventListener('keydown', (e) => {
                        if (e.ctrlKey || e.metaKey) {
                            if (e.key === '=') {
                                e.preventDefault();
                                document.getElementById('zoomIn').click();
                            } else if (e.key === '-') {
                                e.preventDefault();
                                document.getElementById('zoomOut').click();
                            } else if (e.key === '0') {
                                e.preventDefault();
                                document.getElementById('resetZoom').click();
                            } else if (e.key === 'f') {
                                e.preventDefault();
                                document.getElementById('fitContent').click();
                            }
                        } else if (e.key === 'Escape' && isFullscreen) {
                            document.getElementById('toggleFullscreen').click();
                        }
                    });
                    
                    // Adjust on window resize
                    window.addEventListener('resize', () => {
                        if (isFullscreen) {
                            fitContent();
                        }
                    });
                </script>
            </body>
        </html>
    `;
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
}