import ast
import json
import sys
import re

def parse_code(code, language):
    try:
        if language == "python":
            result = generate_python_diagram(code)
        elif language in ["javascript", "typescript"]:
            result = generate_js_ts_diagram(code, language)
        elif language in ["cpp", "c"]:
            result = generate_cpp_diagram(code)
        else:
            result = generate_js_ts_diagram(code, language)  # Fallback to JS parser
        
        # Validate result
        if not isinstance(result, dict):
            return {"error": "Invalid result format"}
        if "error" in result:
            return result
        if not all(key in result for key in ["nodes", "links"]):
            return {"error": "Missing required fields in result"}
        if not isinstance(result["nodes"], list) or not isinstance(result["links"], list):
            return {"error": "Invalid data structure"}
        if not result["nodes"]:
            return {"error": "No code structure detected"}
            
        # Validate each node
        for node in result["nodes"]:
            if not all(key in node for key in ["id", "name", "type", "color"]):
                return {"error": f"Invalid node structure: {node}"}
                
        # Validate each link
        for link in result["links"]:
            if not all(key in link for key in ["source", "target"]):
                return {"error": f"Invalid link structure: {link}"}
        
        return result
    except Exception as e:
        return {"error": f"Error parsing code: {str(e)}"}

def extract_docstring(node):
    """Extract docstring from an AST node."""
    if (isinstance(node, (ast.FunctionDef, ast.ClassDef)) and 
        ast.get_docstring(node)):
        return ast.get_docstring(node)
    return None

def format_arguments(args):
    """Format function arguments into a readable string."""
    params = []
    for arg in args.args:
        param = arg.arg
        # Check for type annotation
        if hasattr(arg, 'annotation') and arg.annotation:
            if isinstance(arg.annotation, ast.Name):
                param += f": {arg.annotation.id}"
            elif isinstance(arg.annotation, ast.Constant):
                param += f": {arg.annotation.value}"
        params.append(param)
    
    if args.vararg:
        params.append(f"*{args.vararg.arg}")
    if args.kwarg:
        params.append(f"**{args.kwarg.arg}")
    
    return ", ".join(params)

def get_colors(node_type):
    """Get colors for different node types with better contrast."""
    colors = {
        "Class": {
            "fill": "#2E7D32",  # Darker green
            "text": "#FFFFFF"    # White text
        },
        "Function": {
            "fill": "#1565C0",  # Darker blue
            "text": "#FFFFFF"    # White text
        },
        "Method": {
            "fill": "#0277BD",  # Medium blue
            "text": "#FFFFFF"    # White text
        },
        "Import": {
            "fill": "#6D4C41",  # Brown
            "text": "#FFFFFF"    # White text
        },
        "Root": {
            "fill": "#37474F",  # Dark gray
            "text": "#FFFFFF"    # White text
        }
    }
    return colors.get(node_type, {
        "fill": "#78909C",  # Default gray
        "text": "#FFFFFF"   # White text
    })

def generate_python_diagram(code):
    try:
        tree = ast.parse(code)
        nodes = []
        links = []
        node_ids = {}
        counter = [0]

        def get_node_id(name):
            if name not in node_ids:
                node_ids[name] = f"node{counter[0]}"
                counter[0] += 1
            return node_ids[name]

        def add_node(name, node_type="", details="", parent=None):
            node_id = get_node_id(name)
            
            # Get colors for this node type
            colors = get_colors(node_type)
            
            nodes.append({
                "id": node_id,
                "name": name,
                "type": node_type,
                "color": colors["fill"],
                "textColor": colors["text"],
                "details": details
            })
            
            if parent:
                links.append({
                    "source": parent,
                    "target": node_id,
                    "type": "contains"
                })
            
            return node_id

        def process_node(node, parent_id=None):
            if isinstance(node, ast.FunctionDef):
                # Extract function information
                args_str = format_arguments(node.args)
                docstring = extract_docstring(node)
                details = f"Parameters: ({args_str})"
                if docstring:
                    details += f"\\nDescription: {docstring.split('.')[0]}"
                
                # Check if it's a method or standalone function
                node_type = "Method" if parent_id else "Function"
                node_id = add_node(node.name, node_type, details, parent_id)
                
                # Process function body for nested definitions
                for child in ast.iter_child_nodes(node):
                    if isinstance(child, (ast.FunctionDef, ast.ClassDef)):
                        process_node(child, node_id)

            elif isinstance(node, ast.ClassDef):
                # Extract class information
                bases = [b.id for b in node.bases if isinstance(b, ast.Name)]
                docstring = extract_docstring(node)
                details = ""
                if bases:
                    details += f"Inherits from: {', '.join(bases)}\\n"
                if docstring:
                    details += f"Description: {docstring.split('.')[0]}"
                
                node_id = add_node(node.name, "Class", details, parent_id)
                
                # Process class body
                for child in ast.iter_child_nodes(node):
                    if isinstance(child, (ast.FunctionDef, ast.ClassDef)):
                        process_node(child, node_id)

            elif isinstance(node, (ast.Import, ast.ImportFrom)):
                names = []
                if isinstance(node, ast.Import):
                    names = [n.name for n in node.names]
                else:
                    module = node.module or ""
                    names = [f"{module}.{n.name}" for n in node.names]
                details = "External dependency"
                add_node(', '.join(names), "Import", details, parent_id)

        # Start processing from the root
        root_id = add_node("Code Structure", "Root", "Main program structure")
        
        # Process imports first, then classes, then functions
        for node in ast.iter_child_nodes(tree):
            if isinstance(node, (ast.Import, ast.ImportFrom)):
                process_node(node, root_id)
        
        for node in ast.iter_child_nodes(tree):
            if isinstance(node, ast.ClassDef):
                process_node(node, root_id)
        
        for node in ast.iter_child_nodes(tree):
            if isinstance(node, ast.FunctionDef):
                process_node(node, root_id)

        return {
            "nodes": nodes,
            "links": links
        }

    except Exception as e:
        return {"error": f"Error parsing Python code: {str(e)}"}

def generate_js_ts_diagram(code, language):
    nodes = []
    links = []
    node_ids = {}
    counter = [0]

    def get_node_id(name):
        if name not in node_ids:
            node_ids[name] = f"node{counter[0]}"
            counter[0] += 1
        return node_ids[name]

    def add_node(name, node_type="", details="", parent=None):
        node_id = get_node_id(name)
        
        colors = get_colors(node_type)
        
        nodes.append({
            "id": node_id,
            "name": name,
            "type": node_type,
            "color": colors["fill"],
            "textColor": colors["text"],
            "details": details
        })
        
        if parent:
            links.append({
                "source": parent,
                "target": node_id,
                "type": "contains"
            })
        
        return node_id
    
    # Add root node
    root_id = add_node(f"{language} Structure", "Root", "Main program structure")
    
    # Enhanced patterns to capture more details
    class_pattern = r'(?:export\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([^{]+))?\s*{\s*(?:\/\*\*([^*]*)\*\/)?\s*'
    function_pattern = r'(?:export\s+)?(?:async\s+)?(?:function|const)\s+(\w+)\s*[=]?\s*(?:\(([^)]*)\))(?:\s*:\s*([^{=]+))?\s*(?:=>|{)\s*(?:\/\*\*([^*]*)\*\/)?\s*'
    
    # Find classes
    for match in re.finditer(class_pattern, code):
        name = match.group(1)
        extends = match.group(2)
        implements = match.group(3)
        doc = match.group(4)
        
        details = []
        if extends:
            details.append(f"Extends: {extends}")
        if implements:
            details.append(f"Implements: {implements}")
        if doc:
            details.append(f"Description: {doc.strip()}")
        
        class_id = add_node(name, "Class", "\\n".join(details), root_id)
        
        # Look for methods within the class
        class_body = code[match.end():].split("\n")
        method_pattern = r'(?:async\s+)?(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^{=]+))?\s*{?\s*(?:\/\*\*([^*]*)\*\/)?\s*'
        
        for line in class_body:
            method_match = re.search(method_pattern, line)
            if method_match:
                method_name = method_match.group(1)
                params = method_match.group(2)
                return_type = method_match.group(3)
                method_doc = method_match.group(4)
                
                method_details = []
                if params:
                    method_details.append(f"Parameters: ({params})")
                if return_type:
                    method_details.append(f"Returns: {return_type}")
                if method_doc:
                    method_details.append(f"Description: {method_doc.strip()}")
                
                add_node(method_name, "Method", "\\n".join(method_details), class_id)
    
    # Find standalone functions
    for match in re.finditer(function_pattern, code):
        name = match.group(1)
        params = match.group(2)
        return_type = match.group(3)
        doc = match.group(4)
        
        if name and not name.startswith('_'):
            details = []
            if params:
                details.append(f"Parameters: ({params})")
            if return_type:
                details.append(f"Returns: {return_type}")
            if doc:
                details.append(f"Description: {doc.strip()}")
            
            add_node(name, "Function", "\\n".join(details), root_id)
    
    return {
        "nodes": nodes,
        "links": links
    }

def generate_cpp_diagram(code):
    nodes = []
    links = []
    node_ids = {}
    counter = [0]

    def get_node_id(name):
        if name not in node_ids:
            node_ids[name] = f"node{counter[0]}"
            counter[0] += 1
        return node_ids[name]

    def add_node(name, node_type="", details="", parent=None):
        node_id = get_node_id(name)
        
        colors = get_colors(node_type)
        
        nodes.append({
            "id": node_id,
            "name": name,
            "type": node_type,
            "color": colors["fill"],
            "textColor": colors["text"],
            "details": details
        })
        
        if parent:
            links.append({
                "source": parent,
                "target": node_id,
                "type": "contains"
            })
        
        return node_id
    
    # Add root node
    root_id = add_node("C++ Structure", "Root", "Main program structure")
    
    # Enhanced patterns to capture more details
    class_pattern = r'class\s+(\w+)(?:\s*:\s*(?:public|private|protected)\s+([^{]+))?\s*{\s*(?:\/\*\*([^*]*)\*\/)?\s*'
    function_pattern = r'(?:virtual\s+)?(?:static\s+)?(\w+)\s+(\w+)\s*\(([^)]*)\)\s*(?:const|noexcept|override|final|)?\s*(?:{|;)\s*(?:\/\*\*([^*]*)\*\/)?\s*'
    
    # Find classes
    for match in re.finditer(class_pattern, code):
        name = match.group(1)
        inheritance = match.group(2)
        doc = match.group(3)
        
        details = []
        if inheritance:
            details.append(f"Inherits: {inheritance}")
        if doc:
            details.append(f"Description: {doc.strip()}")
        
        class_id = add_node(name, "Class", "\\n".join(details), root_id)
        
        # Look for methods within the class
        class_body = code[match.end():].split("\n")
        for line in class_body:
            method_match = re.search(function_pattern, line)
            if method_match:
                return_type = method_match.group(1)
                method_name = method_match.group(2)
                params = method_match.group(3)
                method_doc = method_match.group(4)
                
                if method_name and not method_name in ['if', 'for', 'while', 'switch']:
                    method_details = []
                    method_details.append(f"Return Type: {return_type}")
                    if params:
                        method_details.append(f"Parameters: ({params})")
                    if method_doc:
                        method_details.append(f"Description: {method_doc.strip()}")
                    
                    add_node(method_name, "Method", "\\n".join(method_details), class_id)
    
    # Find standalone functions
    for match in re.finditer(function_pattern, code):
        return_type = match.group(1)
        name = match.group(2)
        params = match.group(3)
        doc = match.group(4)
        
        if name and not name in ['if', 'for', 'while', 'switch']:
            details = []
            details.append(f"Return Type: {return_type}")
            if params:
                details.append(f"Parameters: ({params})")
            if doc:
                details.append(f"Description: {doc.strip()}")
            
            add_node(name, "Function", "\\n".join(details), root_id)
    
    return {
        "nodes": nodes,
        "links": links
    }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No language provided"}))
        sys.exit(1)

    language = sys.argv[1]
    code = sys.stdin.read()

    if not code:
        print(json.dumps({"error": "No code provided"}))
        sys.exit(1)

    diagram = parse_code(code, language)
    print(json.dumps(diagram))