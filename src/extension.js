const vscode = require('vscode');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { isJsLanguage, parseJsTsDiagram } = require('./js_parser');

// Store the current diagram data and context globally
let currentDiagramData = null;
let extensionContext = null;

function getLanguageLabel(languageId) {
    const labels = {
        javascript: 'JavaScript',
        typescript: 'TypeScript',
        javascriptreact: 'JavaScript',
        typescriptreact: 'TypeScript',
        jsx: 'JavaScript',
        tsx: 'TypeScript',
        python: 'Python',
        cpp: 'C++',
        c: 'C',
    };
    return labels[languageId] || languageId;
}

function activate(context) {
    console.log('Code-to-Diagram extension is now active!');
    
    // Store context globally for access in other functions
    extensionContext = context;

    let disposable = vscode.commands.registerCommand('extension.codesketch', async function () {
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
            let result;

            const meta = {
                fileName: path.basename(editor.document.fileName),
                language,
                languageLabel: getLanguageLabel(language),
            };

            if (isJsLanguage(language)) {
                result = parseJsTsDiagram(code, language, editor.document.fileName);
            } else {
                result = await runPythonParser(code, language, editor.document.fileName);
            }

            loadingStatus.dispose();
            handleDiagramResult(result, meta);
        } catch (error) {
            loadingStatus.dispose();
            vscode.window.showErrorMessage(`Error: ${error.message}`);
        }
    });

    // Register a command to export the diagram as SVG
    let exportDisposable = vscode.commands.registerCommand('extension.exportDiagram', function () {
        if (!currentDiagramData) {
            vscode.window.showErrorMessage('No diagram to export. Generate a diagram first.');
            return;
        }
        
        exportDiagramAsSVG(currentDiagramData);
    });

    context.subscriptions.push(disposable, exportDisposable);
}

function handleDiagramResult(result, meta) {
    if (result.error) {
        if (result.error.includes('No code structure')) {
            showDiagram({ nodes: [], links: [], empty: true }, meta);
            return;
        }
        vscode.window.showErrorMessage(`Parser error: ${result.error}`);
        return;
    }
    if (!result.nodes || !result.links) {
        vscode.window.showErrorMessage('Invalid diagram data: missing nodes or links');
        return;
    }
    if (result.nodes.length === 0) {
        showDiagram({ nodes: [], links: [], empty: true }, meta);
        return;
    }

    currentDiagramData = result;
    showDiagram(result, meta);
}

async function runPythonParser(code, language, fileName) {
    await checkPythonInstallation();

    const tempDir = path.join(extensionContext.extensionPath, 'temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
    }

    const parserPath = path.join(tempDir, 'code_parser.py');
    const parserSource = path.join(extensionContext.extensionPath, 'src', 'code_parser.py');
    fs.copyFileSync(parserSource, parserPath);

    return new Promise((resolve, reject) => {
        const basename = path.basename(fileName || 'module.py');
        const pythonProcess = spawn('python', [parserPath, language, basename]);
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

        pythonProcess.on('close', (exitCode) => {
            if (exitCode !== 0) {
                reject(new Error(errorOutput || 'Python parser failed'));
                return;
            }
            try {
                resolve(JSON.parse(output));
            } catch (error) {
                reject(new Error(`Failed to parse output: ${error.message}`));
            }
        });
    });
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

function showDiagram(data, meta = {}) {
    console.log('Creating webview panel for diagram');

    const panel = vscode.window.createWebviewPanel(
        'diagramPreview',
        'Code Diagram',
        vscode.ViewColumn.Two,
        {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
                vscode.Uri.joinPath(extensionContext.extensionUri, 'node_modules')
            ]
        }
    );

    const isDarkTheme = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark;
    const bgColor = isDarkTheme ? '#1e1e1e' : '#ffffff';
    const textColor = isDarkTheme ? '#d4d4d4' : '#333333';
    const subtleColor = isDarkTheme ? '#888' : '#666';

    if (data.empty || !data.nodes || data.nodes.length === 0) {
        panel.webview.html = `<!DOCTYPE html>
        <html><head><meta charset="UTF-8">
        <style>
            body { margin: 0; padding: 40px; background: ${bgColor}; color: ${textColor};
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                display: flex; flex-direction: column; align-items: center; justify-content: center;
                min-height: 100vh; text-align: center; }
            .empty-msg { max-width: 420px; line-height: 1.6; color: ${subtleColor}; font-size: 14px; }
            .status-bar { position: fixed; bottom: 0; left: 0; right: 0; padding: 6px 14px;
                font-size: 11px; color: ${subtleColor}; background: ${isDarkTheme ? '#252526' : '#f3f3f3'};
                border-top: 1px solid ${isDarkTheme ? '#333' : '#ddd'}; }
        </style></head><body>
            <p class="empty-msg">No structure detected. This file may be too simple or use syntax the parser doesn't recognize yet.</p>
            <div class="status-bar">${meta.fileName || 'Unknown'} &nbsp;&middot;&nbsp; ${meta.languageLabel || meta.language || ''}</div>
        </body></html>`;
        return;
    }

    const d3Uri = panel.webview.asWebviewUri(
        vscode.Uri.joinPath(extensionContext.extensionUri, 'node_modules', 'd3', 'dist', 'd3.min.js')
    );

    const statusText = `${meta.fileName || 'Unknown'} &nbsp;&middot;&nbsp; ${meta.languageLabel || meta.language || ''} &nbsp;&middot;&nbsp; ${data.nodes.length} nodes &nbsp;&middot;&nbsp; ${data.links.length} links`;

    console.log('Current theme:', isDarkTheme ? 'dark' : 'light');
    console.log('Data to be visualized:', JSON.stringify(data, null, 2));

    panel.webview.html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <script src="${d3Uri}"></script>
            <style>
                body {
                    margin: 0;
                    padding: 0;
                    background-color: ${bgColor};
                    color: ${textColor};
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    overflow: hidden;
                    width: 100vw;
                    height: 100vh;
                }
                #diagram-container {
                    width: 100%;
                    height: calc(100% - 28px);
                    position: relative;
                }
                #diagram {
                    width: 100%;
                    height: 100%;
                }
                .node {
                    cursor: pointer;
                }
                .node rect {
                    stroke-width: 2px;
                    stroke: ${isDarkTheme ? '#555' : '#ccc'};
                    transition: stroke 0.3s ease;
                }
                .node:hover rect {
                    stroke: ${isDarkTheme ? '#00aaff' : '#3474eb'};
                    stroke-width: 3px;
                }
                .node text {
                    font-size: 13px;
                    font-weight: 500;
                    font-family: 'Segoe UI', 'SF Pro Display', -apple-system, sans-serif;
                    pointer-events: none;
                }
                .link {
                    transition: stroke-width 0.2s ease;
                }
                .link-contains {
                    stroke: ${isDarkTheme ? '#888' : '#aaa'};
                    stroke-width: 1px;
                }
                .link-calls {
                    stroke: ${isDarkTheme ? '#4fc3f7' : '#1976d2'};
                    stroke-width: 2.5px;
                }
                .link-imports {
                    stroke: ${isDarkTheme ? '#888' : '#aaa'};
                    stroke-width: 1.5px;
                    stroke-dasharray: 6, 4;
                }
                .legend {
                    position: absolute;
                    bottom: 38px;
                    left: 10px;
                    background: ${isDarkTheme ? 'rgba(40, 40, 40, 0.85)' : 'rgba(240, 240, 240, 0.9)'};
                    padding: 8px 12px;
                    border-radius: 6px;
                    font-size: 11px;
                    z-index: 1000;
                    line-height: 1.8;
                }
                .legend-item { display: flex; align-items: center; gap: 8px; }
                .legend-line { width: 28px; height: 0; }
                .legend-line.contains { border-top: 1px solid ${isDarkTheme ? '#888' : '#aaa'}; }
                .legend-line.calls { border-top: 2.5px solid ${isDarkTheme ? '#4fc3f7' : '#1976d2'}; }
                .legend-line.imports { border-top: 1.5px dashed ${isDarkTheme ? '#888' : '#aaa'}; }
                .status-bar {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    height: 28px;
                    line-height: 28px;
                    padding: 0 14px;
                    font-size: 11px;
                    color: ${subtleColor};
                    background: ${isDarkTheme ? '#252526' : '#f3f3f3'};
                    border-top: 1px solid ${isDarkTheme ? '#333' : '#ddd'};
                    z-index: 1000;
                }
                .controls {
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    background: ${isDarkTheme ? 'rgba(40, 40, 40, 0.8)' : 'rgba(240, 240, 240, 0.8)'};
                    padding: 10px;
                    border-radius: 6px;
                    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
                    z-index: 1000;
                }
                .control-button {
                    background: ${isDarkTheme ? '#333' : '#f0f0f0'};
                    border: 1px solid ${isDarkTheme ? '#555' : '#ccc'};
                    color: ${isDarkTheme ? '#eee' : '#333'};
                    padding: 4px 8px;
                    margin: 2px 4px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                }
                .control-button:hover {
                    background: ${isDarkTheme ? '#444' : '#e0e0e0'};
                }
                .node-tooltip {
                    position: absolute;
                    background: ${isDarkTheme ? '#333' : '#f9f9f9'};
                    border: 1px solid ${isDarkTheme ? '#555' : '#ddd'};
                    border-radius: 4px;
                    padding: 8px;
                    font-size: 12px;
                    max-width: 300px;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                    display: none;
                    z-index: 1001;
                    pointer-events: none;
                }
                /* Animation for node appearance */
                @keyframes nodeAppear {
                    from { opacity: 0; transform: scale(0.8); }
                    to { opacity: 1; transform: scale(1); }
                }
                .node {
                    animation: nodeAppear 0.4s ease-out;
                }
            </style>
        </head>
        <body>
            <div id="diagram-container">
                <div id="diagram"></div>
                <div class="controls">
                    <button id="reset-zoom" class="control-button">Reset View</button>
                    <button id="fit-content" class="control-button">Fit Content</button>
                    <button id="export-svg" class="control-button">Export SVG</button>
                </div>
                <div id="node-tooltip" class="node-tooltip"></div>
                <div class="legend">
                    <div class="legend-item"><span class="legend-line contains"></span> contains</div>
                    <div class="legend-item"><span class="legend-line calls"></span> calls</div>
                    <div class="legend-item"><span class="legend-line imports"></span> imports</div>
                </div>
                <div class="status-bar">${statusText}</div>
            </div>
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
                        
                        // Make the canvas size dynamically fit the window
                        const setCanvasSize = () => {
                            return {
                                width: window.innerWidth,
                                height: window.innerHeight
                            };
                        };
                        
                        let dimensions = setCanvasSize();
                        let width = dimensions.width;
                        let height = dimensions.height;
                        
                        console.log('Creating SVG with dimensions:', width, height);
                        
                        // Create SVG container with increased canvas size
                        const svg = d3.select('#diagram')
                            .append('svg')
                            .attr('width', width)
                            .attr('height', height)
                            .attr('viewBox', [0, 0, width, height])
                            .attr('id', 'diagram-svg');
                            
                        // Create a larger virtual canvas (3x size) for better spacing
                        const virtualWidth = width * 3;
                        const virtualHeight = height * 3;
                        
                        // Add zoom support
                        const g = svg.append('g');
                        
                        // Add optional grid pattern for background (helps with spatial orientation)
                        const defs = svg.append("defs");
                        defs.append("pattern")
                            .attr("id", "grid")
                            .attr("width", 50)
                            .attr("height", 50)
                            .attr("patternUnits", "userSpaceOnUse")
                            .append("path")
                            .attr("d", "M 50 0 L 0 0 0 50")
                            .attr("fill", "none")
                            .attr("stroke", ${isDarkTheme ? "'rgba(80, 80, 80, 0.2)'" : "'rgba(200, 200, 200, 0.3)'"})
                            .attr("stroke-width", "1");
                            
                        // Add grid background
                        svg.append("rect")
                            .attr("width", width)
                            .attr("height", height)
                            .attr("fill", "url(#grid)");
                            
                        // Set up zoom behavior
                        const zoom = d3.zoom()
                            .extent([[0, 0], [width, height]])
                            .scaleExtent([0.1, 4])
                            .on('zoom', (event) => {
                                g.attr('transform', event.transform);
                            });
                            
                        svg.call(zoom);
                        
                        // Tooltip element
                        const tooltip = d3.select("#node-tooltip");
                        
                        console.log('Creating force simulation');
                        // Create the force simulation with improved forces
                        const simulation = d3.forceSimulation(data.nodes)
                            .force('link', d3.forceLink(data.links)
                                .id(d => d.id)
                                .distance(220))
                            .force('charge', d3.forceManyBody()
                                .strength(-2500))
                            .force('center', d3.forceCenter(virtualWidth / 2, virtualHeight / 2))
                            .force('collision', d3.forceCollide().radius(140))
                            .force('x', d3.forceX(virtualWidth / 2).strength(0.02))
                            .force('y', d3.forceY(virtualHeight / 2).strength(0.02));
                            
                        // Line generator for curved links
                        const linkGenerator = d3.linkHorizontal()
                            .x(d => d.x)
                            .y(d => d.y);
                            
                        console.log('Creating links');
                        const linkTypeClass = (type) => {
                            if (type === 'calls') return 'link-calls';
                            if (type === 'imports') return 'link-imports';
                            return 'link-contains';
                        };

                        const link = g.append('g')
                            .attr('class', 'links')
                            .selectAll('path')
                            .data(data.links)
                            .join('path')
                            .attr('class', d => 'link ' + linkTypeClass(d.type || 'contains'))
                            .attr('stroke-opacity', 0.9)
                            .attr('fill', 'none');

                        svg.append('defs').selectAll('marker')
                            .data(['calls'])
                            .join('marker')
                            .attr('id', 'arrow-calls')
                            .attr('viewBox', '0 -5 10 10')
                            .attr('refX', 25)
                            .attr('refY', 0)
                            .attr('markerWidth', 6)
                            .attr('markerHeight', 6)
                            .attr('orient', 'auto')
                            .append('path')
                            .attr('fill', ${isDarkTheme ? "'#4fc3f7'" : "'#1976d2'"})
                            .attr('d', 'M0,-5L10,0L0,5');

                        link.attr('marker-end', d => (d.type === 'calls') ? 'url(#arrow-calls)' : null);
                        
                        console.log('Creating nodes');
                        // Create node groups with improved styling
                        const node = g.append('g')
                            .attr('class', 'nodes')
                            .selectAll('g')
                            .data(data.nodes)
                            .join('g')
                            .attr('class', 'node')
                            .call(d3.drag()
                                .on('start', dragstarted)
                                .on('drag', dragged)
                                .on('end', dragended));
                                
                        // Gradient for node backgrounds
                        const gradients = defs.selectAll('.node-gradient')
                            .data(data.nodes)
                            .join('linearGradient')
                            .attr('id', d => 'gradient-' + d.id)
                            .attr('x1', '0%')
                            .attr('x2', '0%')
                            .attr('y1', '0%')
                            .attr('y2', '100%');
                            
                        gradients.append('stop')
                            .attr('offset', '0%')
                            .attr('stop-color', d => {
                                const color = d3.color(d.color || '#5a8de6');
                                return color.brighter(0.2);
                            });
                            
                        gradients.append('stop')
                            .attr('offset', '100%')
                            .attr('stop-color', d => d.color || '#5a8de6');
                                
                        // Add rectangles for nodes with gradients
                        node.append('rect')
                            .attr('rx', 8)
                            .attr('ry', 8)
                            .attr('stroke-width', 2)
                            .attr('fill', d => 'url(#gradient-' + d.id + ')')
                            .attr('stroke', ${isDarkTheme ? "'#555'" : "'#ccc'"});
                        
                        // Add text labels with improved styling
                        node.append('text')
                            .attr('text-anchor', 'middle')
                            .attr('dy', '0.35em')
                            .attr('fill', d => d.textColor || '#fff')
                            .text(d => d.name)
                            .each(function(d) {
                                // Word wrapping for long node names
                                const text = d3.select(this);
                                const words = d.name.split(/\\s+/);
                                if (words.length > 1 && d.name.length > 15) {
                                    text.text('');
                                    
                                    // Split into two lines if text is long
                                    const tspan1 = text.append('tspan')
                                        .attr('x', 0)
                                        .attr('dy', '-0.6em')
                                        .text(words.slice(0, Math.ceil(words.length/2)).join(' '));
                                        
                                    const tspan2 = text.append('tspan')
                                        .attr('x', 0)
                                        .attr('dy', '1.2em')
                                        .text(words.slice(Math.ceil(words.length/2)).join(' '));
                                }
                            });
                            
                        // Set improved node sizes
                        node.each(function() {
                            const g = d3.select(this);
                            const text = g.select('text');
                            const textBounds = text.node().getBBox();
                            
                            // Make rectangles bigger with more padding
                            const width = Math.max(textBounds.width + 60, 100);
                            const height = Math.max(textBounds.height + 30, 40);
                            
                            g.select('rect')
                                .attr('width', width)
                                .attr('height', height)
                                .attr('x', -width/2)
                                .attr('y', -height/2);
                        });
                        
                        // Add hover effects and tooltips
                        node.on('mouseover', function(event, d) {
                                d3.select(this).select('rect')
                                    .transition()
                                    .duration(200)
                                    .attr('stroke-width', 3);
                                    
                                // Show tooltip with node details if available
                                if (d.details) {
                                    tooltip
                                        .style('display', 'block')
                                        .style('left', (event.pageX + 10) + 'px')
                                        .style('top', (event.pageY + 10) + 'px')
                                        .html('<strong>' + d.name + '</strong><br/>' + d.details);
                                }
                            })
                            .on('mousemove', function(event) {
                                tooltip
                                    .style('left', (event.pageX + 10) + 'px')
                                    .style('top', (event.pageY + 10) + 'px');
                            })
                            .on('mouseout', function() {
                                d3.select(this).select('rect')
                                    .transition()
                                    .duration(200)
                                    .attr('stroke-width', 2);
                                tooltip.style('display', 'none');
                            });
                        
                        console.log('Setting up simulation tick');
                        // Update positions on simulation tick with curved links
                        simulation.on('tick', () => {
                            link.attr('d', d => {
                                const path = \`M\${d.source.x},\${d.source.y} C\${(d.source.x + d.target.x) / 2},\${d.source.y} \${(d.source.x + d.target.x) / 2},\${d.target.y} \${d.target.x},\${d.target.y}\`;
                                return path;
                            });
                                
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
                            // Keep node in place after drag ends
                            // event.subject.fx = null;
                            // event.subject.fy = null;
                        }
                        
                        // Adjust forces for optimal layout
                        const nodeCount = data.nodes.length;
                        if (nodeCount > 10) {
                            simulation.force('link').distance(280);
                            simulation.force('charge').strength(-3200);
                        } else if (nodeCount < 5) {
                            simulation.force('link').distance(200);
                            simulation.force('charge').strength(-1800);
                        }
                        
                        // Control buttons functionality
                        d3.select('#reset-zoom').on('click', function() {
                            svg.transition().duration(750).call(
                                zoom.transform,
                                d3.zoomIdentity
                            );
                        });
                        
                        d3.select('#fit-content').on('click', function() {
                            // Calculate the bounds of the graph
                            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                            data.nodes.forEach(node => {
                                minX = Math.min(minX, node.x);
                                minY = Math.min(minY, node.y);
                                maxX = Math.max(maxX, node.x);
                                maxY = Math.max(maxY, node.y);
                            });
                            
                            // Add padding
                            const padding = 50;
                            minX -= padding;
                            minY -= padding;
                            maxX += padding;
                            maxY += padding;
                            
                            const contentWidth = maxX - minX;
                            const contentHeight = maxY - minY;
                            
                            // Calculate appropriate zoom level
                            const scale = Math.min(width / contentWidth, height / contentHeight) * 0.9;
                            const translateX = (width - contentWidth * scale) / 2 - minX * scale;
                            const translateY = (height - contentHeight * scale) / 2 - minY * scale;
                            
                            svg.transition().duration(750).call(
                                zoom.transform,
                                d3.zoomIdentity
                                    .translate(translateX, translateY)
                                    .scale(scale)
                            );
                        });
                        
                        // Export SVG function
                        d3.select('#export-svg').on('click', function() {
                            // Trigger a message back to the VS Code extension
                            const vscode = acquireVsCodeApi();
                            vscode.postMessage({
                                command: 'exportSVG'
                            });
                        });
                        
                        // Handle window resize
                        window.addEventListener('resize', function() {
                            const newDimensions = setCanvasSize();
                            svg.attr('width', newDimensions.width)
                               .attr('height', newDimensions.height);
                        });
                        
                        // Automatically fit content on initial load
                        setTimeout(() => {
                            d3.select('#fit-content').dispatch('click');
                        }, 500);
                        
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
                
                // Function to communicate with VS Code extension
                function acquireVsCodeApi() {
                    return {
                        postMessage: function(message) {
                            window.parent.postMessage(message, '*');
                        }
                    };
                }
            </script>
        </body>
        </html>
    `;
    
    // Handle messages from the webview
    panel.webview.onDidReceiveMessage(
        message => {
            console.log('Webview message:', message);
            
            if (message.command === 'exportSVG') {
                exportDiagramAsSVG(data);
            }
            
            if (message.type === 'error') {
                vscode.window.showErrorMessage(`Diagram error: ${message.message}`);
            }
        },
        undefined,
        extensionContext.subscriptions
    );
}

function exportDiagramAsSVG(data) {
    // Create export dialog
    vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file('code_diagram.svg'),
        filters: {
            'SVG Files': ['svg']
        }
    }).then(fileUri => {
        if (fileUri) {
            // Generate a clean SVG export version
            const isDarkTheme = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark;
            
            // Generate SVG content
            const svgContent = generateSVGContent(data, isDarkTheme);
            
            // Write to file
            fs.writeFile(fileUri.fsPath, svgContent, err => {
                if (err) {
                    vscode.window.showErrorMessage(`Failed to export diagram: ${err.message}`);
                } else {
                    vscode.window.showInformationMessage(`Diagram exported to ${fileUri.fsPath}`);
                }
            });
        }
    });
}

function generateSVGContent(data, isDarkTheme) {
    // Create a simplified SVG for export
    const width = 1200;
    const height = 800;
    
    // Basic SVG header
    let svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <style>
        .node rect {
            stroke-width: 2px;
            stroke: ${isDarkTheme ? '#555' : '#ccc'};
        }
        .node text {
            font-size: 13px;
            font-weight: 500;
            font-family: 'Segoe UI', 'SF Pro Display', -apple-system, sans-serif;
        }
        .link {
            stroke: ${isDarkTheme ? '#666' : '#999'};
            stroke-width: 2px;
            fill: none;
        }
    </style>
    <rect width="${width}" height="${height}" fill="${isDarkTheme ? '#1e1e1e' : '#ffffff'}"/>
`;

    // Position nodes in a grid layout for the export
    const nodeSize = 120;
    const margin = 50;
    const cols = Math.ceil(Math.sqrt(data.nodes.length));
    const rows = Math.ceil(data.nodes.length / cols);
    
    // Calculate grid positions
    data.nodes.forEach((node, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        node.x = margin + col * (nodeSize + margin) + nodeSize / 2;
        node.y = margin + row * (nodeSize + margin) + nodeSize / 2;
    });
    
    // Add links
    svg += `    <g class="links">`;
    data.links.forEach(link => {
        const source = data.nodes.find(n => n.id === link.source);
        const target = data.nodes.find(n => n.id === link.target);
        if (source && target) {
            const linkType = link.type || 'contains';
            const dash = linkType === 'imports' ? ' stroke-dasharray="6,4"' : '';
            const strokeWidth = linkType === 'calls' ? '2.5' : linkType === 'contains' ? '1' : '1.5';
            const stroke = linkType === 'calls' ? (isDarkTheme ? '#4fc3f7' : '#1976d2') : (isDarkTheme ? '#888' : '#aaa');
            svg += `
        <path class="link" stroke="${stroke}" stroke-width="${strokeWidth}"${dash} d="M${source.x},${source.y} C${(source.x + target.x) / 2},${source.y} ${(source.x + target.x) / 2},${target.y} ${target.x},${target.y}" />`;
        }
    });
    svg += `
    </g>`;
    
    // Add nodes
    svg += `    <g class="nodes">`;
    data.nodes.forEach(node => {
        // Calculate rectangle dimensions
        const label = node.name;
        const width = Math.max(label.length * 8 + 40, 100);
        const height = 40;
        
        svg += `
        <g class="node" transform="translate(${node.x},${node.y})">
            <rect x="${-width/2}" y="${-height/2}" width="${width}" height="${height}" rx="8" ry="8" fill="${node.color || '#5a8de6'}" />
            <text text-anchor="middle" dy="0.35em" fill="${node.textColor || '#fff'}">${node.name}</text>
        </g>`;
    });
    svg += `
    </g>`;
    
    // Close SVG
    svg += `
</svg>`;

    return svg;
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
}
