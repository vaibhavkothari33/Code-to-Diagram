
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
        diagram = "graph TD;\n"
        diagram += "%%{ init: { 'flowchart': { 'curve': 'basis', 'nodeSpacing': 50, 'rankSpacing': 70 } } }%%\n"
        diagram += "\n".join(nodes) + "\n" + "\n".join(edges)
        
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
    class_pattern = r'classs+(w+)(?:s+extendss+(w+))?'
    for match in re.finditer(class_pattern, code):
        class_name = match.group(1)
        parent_class = match.group(2)
        
        node_id = f"node{node_counter}"
        if parent_class:
            label = f"Class: {class_name}\nextends {parent_class}"
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
        method_pattern = r'(?:asyncs+)?(?:statics+)?(?:get|set)?s*(w+)s*([^)]*)s*{|(?:asyncs+)?(w+)s*=s*(?:([^)]*)|asyncs*([^)]*))s*=>'
        for method_match in re.finditer(method_pattern, class_body):
            method_name = method_match.group(1) or method_match.group(2)
            if method_name and method_name not in ['constructor', 'if', 'for', 'while', 'switch']:
                method_id = f"node{node_counter}"
                nodes.append(f'{method_id}["Method: {method_name}"]:::methodNode')
                edges.append(f"{node_id} --> {method_id}")
                node_counter += 1
    
    # Find standalone functions
    function_patterns = [
        r'functions+(w+)s*([^)]*)',  # Normal function declaration
        r'consts+(w+)s*=s*(?:asyncs*)?([^)]*)s*=>',  # Arrow function with parameters
        r'consts+(w+)s*=s*(?:asyncs*)?s*functions*([^)]*)'  # Function expression
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
    diagram = "graph TD;\n"
    diagram += "%%{ init: { 'flowchart': { 'curve': 'basis', 'nodeSpacing': 50, 'rankSpacing': 60 } } }%%\n"
    diagram += "\n".join(nodes) + "\n" + "\n".join(edges)
    
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
    class_pattern = r'classs+(w+)(?:s*:s*(?:public|private|protected)s+(w+))?'
    for match in re.finditer(class_pattern, code):
        class_name = match.group(1)
        parent_class = match.group(2)
        
        node_id = f"node{node_counter}"
        if parent_class:
            label = f"Class: {class_name}\ninherits {parent_class}"
        else:
            label = f"Class: {class_name}"
        
        nodes.append(f'{node_id}["{label}"]:::classNode')
        edges.append(f"{root_id} --> {node_id}")
        node_counter += 1
    
    # Find standalone functions (simplified)
    function_pattern = r'(?:static|inline|virtual|explicit|)?s*(?:const|volatile|)?s*(?:w+(?:::w+)*(?:<[^>]*>)?&*s+)(w+)s*([^{;]*)s*(?:const|noexcept|override|final|)?s*(?:=s*(?:default|delete|0)|)'
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
    diagram = "graph TD;\n"
    diagram += "%%{ init: { 'flowchart': { 'curve': 'basis', 'nodeSpacing': 50, 'rankSpacing': 60 } } }%%\n"
    diagram += "\n".join(nodes) + "\n" + "\n".join(edges)
    
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
