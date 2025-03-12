const vscode = require('vscode');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

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
        
        if (!language || !code) {
            vscode.window.showErrorMessage('No code or language detected!');
            return;
        }

        // Start loading indicator
        const loadingStatus = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        loadingStatus.text = "$(sync~spin) Generating diagram...";
        loadingStatus.show();

        try {
            // Check Python installation
            await checkPythonInstallation();
            
            // Copy parser script to temp directory
            const tempDir = path.join(context.extensionPath, 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir);
            }
            
            const parserPath = path.join(tempDir, 'code_parser.py');
            const parserSource = path.join(context.extensionPath, 'src', 'code_parser.py');
            fs.copyFileSync(parserSource, parserPath);

            // Run the parser
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

            pythonProcess.on('close', async (code) => {
                loadingStatus.dispose();
                
                if (code !== 0) {
                    vscode.window.showErrorMessage(`Parser error: ${errorOutput}`);
                    return;
                }

                try {
                    console.log('Raw output:', output);
                    const result = JSON.parse(output);
                    console.log('Parsed result:', result);
                    if (result.error) {
                        vscode.window.showErrorMessage(`Parser error: ${result.error}`);
                    } else {
                        if (!result.nodes || !result.links) {
                            vscode.window.showErrorMessage('Invalid diagram data: missing nodes or links');
                            return;
                        }
                        if (result.nodes.length === 0) {
                            vscode.window.showErrorMessage('No code structure detected in the file');
                            return;
                        }
                        showDiagram(result);
                    }
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to parse output: ${error.message}`);
                    console.error('Raw output:', output);
                }
            });
        } catch (error) {
            loadingStatus.dispose();
            vscode.window.showErrorMessage(`Error: ${error.message}`);
        }
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

function showDiagram(data) {
    // Add debug logging
    console.log('Creating webview panel for diagram');
    
    const panel = vscode.window.createWebviewPanel(
        'diagramPreview',
        'Code Diagram',
        vscode.ViewColumn.Two,
        {
            enableScripts: true,
            retainContextWhenHidden: true
        }
    );

    const isDarkTheme = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark;
    console.log('Current theme:', isDarkTheme ? 'dark' : 'light');
    console.log('Data to be visualized:', JSON.stringify(data, null, 2));

    panel.webview.html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <script src="https://d3js.org/d3.v7.min.js"></script>
            <style>
                body {
                    margin: 0;
                    padding: 20px;
                    background-color: ${isDarkTheme ? '#1e1e1e' : '#ffffff'};
                    color: ${isDarkTheme ? '#d4d4d4' : '#333333'};
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    overflow: hidden;
                }
                #diagram {
                    width: 100%;
                    height: 100vh;
                    position: fixed;
                    top: 0;
                    left: 0;
                }
                .node {
                    cursor: pointer;
                }
                .node rect {
                    stroke-width: 2px;
                    stroke: ${isDarkTheme ? '#555' : '#ccc'};
                }
                .node text {
                    font-size: 12px;
                    font-weight: 500;
                }
                .link {
                    stroke: ${isDarkTheme ? '#666' : '#999'};
                    stroke-width: 2px;
                }
            </style>
        </head>
        <body>
            <div id="diagram"></div>
            <script>
                // Wait for D3.js to load
                window.onload = function() {
                    console.log('Window loaded, initializing diagram');
                    try {
                        const data = ${JSON.stringify(data)};
                        console.log('Data received in browser:', data);
                        
                        if (!data || !data.nodes || !data.links) {
                            throw new Error('Invalid data structure received');
                        }
                        
                        const width = window.innerWidth;
                        const height = window.innerHeight;
                        
                        console.log('Creating SVG with dimensions:', width, height);
                        
                        // Create SVG container
                        const svg = d3.select('#diagram')
                            .append('svg')
                            .attr('width', width)
                            .attr('height', height)
                            .style('border', '1px solid #ccc'); // Debug border
                            
                        // Add zoom support
                        const g = svg.append('g');
                        svg.call(d3.zoom()
                            .extent([[0, 0], [width, height]])
                            .scaleExtent([0.1, 4])
                            .on('zoom', (event) => {
                                g.attr('transform', event.transform);
                            }));
                            
                        console.log('Creating force simulation');
                        // Create the force simulation
                        const simulation = d3.forceSimulation(data.nodes)
                            .force('link', d3.forceLink(data.links)
                                .id(d => d.id)
                                .distance(150))
                            .force('charge', d3.forceManyBody()
                                .strength(-1000))
                            .force('center', d3.forceCenter(width / 2, height / 2))
                            .force('collision', d3.forceCollide().radius(100));
                            
                        console.log('Creating links');
                        // Add links
                        const link = g.append('g')
                            .selectAll('line')
                            .data(data.links)
                            .join('line')
                            .attr('class', 'link');
                            
                        console.log('Creating nodes');
                        // Create node groups
                        const node = g.append('g')
                            .selectAll('g')
                            .data(data.nodes)
                            .join('g')
                            .attr('class', 'node')
                            .call(d3.drag()
                                .on('start', dragstarted)
                                .on('drag', dragged)
                                .on('end', dragended));
                                
                        // Add rectangles for nodes
                        node.append('rect')
                            .attr('rx', 6)
                            .attr('ry', 6)
                            .attr('fill', d => d.color || '#999')
                            .attr('stroke', ${isDarkTheme ? "'#555'" : "'#ccc'"});
                        
                        // Add text labels
                        node.append('text')
                            .attr('text-anchor', 'middle')
                            .attr('dy', '0.35em')
                            .attr('fill', d => d.textColor || '#fff')
                            .text(d => d.name);
                        
                        // Size the rectangles based on text
                        node.each(function() {
                            const g = d3.select(this);
                            const text = g.select('text');
                            const width = text.node().getComputedTextLength() + 40;
                            const height = 30;
                            
                            g.select('rect')
                                .attr('width', width)
                                .attr('height', height)
                                .attr('x', -width/2)
                                .attr('y', -height/2);
                        });
                        
                        console.log('Setting up simulation tick');
                        // Update positions on simulation tick
                        simulation.on('tick', () => {
                            link
                                .attr('x1', d => d.source.x)
                                .attr('y1', d => d.source.y)
                                .attr('x2', d => d.target.x)
                                .attr('y2', d => d.target.y);
                                
                            node.attr('transform', d => \`translate(\${d.x},\${d.y})\`);
                        });
                        
                        // Drag functions
                        function dragstarted(event) {
                            if (!event.active) simulation.alphaTarget(0.3).restart();
                            event.subject.fx = event.subject.x;
                            event.subject.fy = event.subject.y;
                        }
                        
                        function dragged(event) {
                            event.subject.fx = event.x;
                            event.subject.fy = event.y;
                        }
                        
                        function dragended(event) {
                            if (!event.active) simulation.alphaTarget(0);
                            event.subject.fx = null;
                            event.subject.fy = null;
                        }
                        
                        console.log('Diagram initialization complete');
                    } catch (error) {
                        console.error('Error rendering diagram:', error);
                        document.body.innerHTML = \`
                            <div style="color: red; padding: 20px;">
                                <h2>Error rendering diagram</h2>
                                <pre>\${error.message}</pre>
                                <p>Please check the developer console for more details.</p>
                            </div>
                        \`;
                    }
                };
            </script>
        </body>
        </html>
    `;
    
    // Log when the webview is ready
    panel.webview.onDidReceiveMessage(
        message => {
            console.log('Webview message:', message);
        },
        undefined,
        []
    );

    // Add error handler for webview
    panel.webview.onDidReceiveMessage(
        message => {
            if (message.type === 'error') {
                vscode.window.showErrorMessage(`Diagram error: ${message.message}`);
            }
        }
    );
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
}