import ast
import json
import sys
import re
import os

def parse_code(code, language, filename=None):
    try:
        root_label = filename or "Code Structure"

        if language == "python":
            result = generate_python_diagram(code, root_label)
        elif language in ["javascript", "typescript", "javascriptreact", "typescriptreact", "jsx", "tsx"]:
            result = generate_js_ts_diagram(code, language, root_label)
        elif language in ["cpp", "c"]:
            result = generate_cpp_diagram(code, root_label)
        else:
            result = generate_js_ts_diagram(code, language, root_label)

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

        for node in result["nodes"]:
            if not all(key in node for key in ["id", "name", "type", "color"]):
                return {"error": f"Invalid node structure: {node}"}

        for link in result["links"]:
            if not all(key in link for key in ["source", "target"]):
                return {"error": f"Invalid link structure: {link}"}

        return result
    except Exception as e:
        return {"error": f"Error parsing code: {str(e)}"}

def extract_docstring(node):
    if isinstance(node, (ast.FunctionDef, ast.ClassDef)) and ast.get_docstring(node):
        return ast.get_docstring(node)
    return None

def format_arguments(args):
    params = []
    for arg in args.args:
        param = arg.arg
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
    colors = {
        "Class": {"fill": "#2E7D32", "text": "#FFFFFF"},
        "Function": {"fill": "#1565C0", "text": "#FFFFFF"},
        "Method": {"fill": "#0277BD", "text": "#FFFFFF"},
        "Component": {"fill": "#7C3AED", "text": "#FFFFFF"},
        "Import": {"fill": "#6D4C41", "text": "#FFFFFF"},
        "Root": {"fill": "#37474F", "text": "#FFFFFF"},
    }
    return colors.get(node_type, {"fill": "#78909C", "text": "#FFFFFF"})

def get_call_name(node):
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        return node.attr
    return None

def is_react_component(body_text):
    if re.search(r'return\s*\(\s*\n?\s*<', body_text):
        return True
    if re.search(r'return\s+<', body_text):
        return True
    if re.search(r'<(div|span|button)\b', body_text):
        return True
    if re.search(r'<\s*[A-Z][a-zA-Z0-9]*', body_text):
        return True
    return False

def extract_braced_body(code, start_pos):
    brace_start = code.find('{', start_pos)
    if brace_start == -1:
        arrow = code.find('=>', start_pos)
        if arrow == -1:
            return ''
        end = code.find('\n', arrow)
        return code[arrow:end if end != -1 else len(code)]
    depth = 0
    for i in range(brace_start, len(code)):
        if code[i] == '{':
            depth += 1
        elif code[i] == '}':
            depth -= 1
            if depth == 0:
                return code[brace_start:i + 1]
    return code[brace_start:]

def generate_python_diagram(code, root_label="Code Structure"):
    try:
        tree = ast.parse(code)
        nodes = []
        links = []
        node_ids = {}
        link_keys = set()
        counter = [0]
        function_records = []

        def get_node_id(name):
            if name not in node_ids:
                node_ids[name] = f"node{counter[0]}"
                counter[0] += 1
            return node_ids[name]

        def add_link(source, target, link_type="contains"):
            key = (source, target, link_type)
            if source == target or key in link_keys:
                return
            link_keys.add(key)
            links.append({"source": source, "target": target, "type": link_type})

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
                add_link(parent, node_id, "contains")

            return node_id

        def process_node(node, parent_id=None):
            if isinstance(node, ast.FunctionDef):
                args_str = format_arguments(node.args)
                docstring = extract_docstring(node)
                details = f"Parameters: ({args_str})"
                if docstring:
                    details += f"\\nDescription: {docstring.split('.')[0]}"

                node_type = "Method" if parent_id else "Function"
                node_id = add_node(node.name, node_type, details, parent_id)
                function_records.append((node_id, node))

                for child in ast.iter_child_nodes(node):
                    if isinstance(child, (ast.FunctionDef, ast.ClassDef)):
                        process_node(child, node_id)

            elif isinstance(node, ast.ClassDef):
                bases = [b.id for b in node.bases if isinstance(b, ast.Name)]
                docstring = extract_docstring(node)
                details = ""
                if bases:
                    details += f"Inherits from: {', '.join(bases)}\\n"
                if docstring:
                    details += f"Description: {docstring.split('.')[0]}"

                node_id = add_node(node.name, "Class", details, parent_id)

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
                add_node(', '.join(names), "Import", "External dependency", parent_id)

        root_id = add_node(root_label, "Root", "Main program structure")

        for node in ast.iter_child_nodes(tree):
            if isinstance(node, (ast.Import, ast.ImportFrom)):
                process_node(node, root_id)

        for node in ast.iter_child_nodes(tree):
            if isinstance(node, ast.ClassDef):
                process_node(node, root_id)

        for node in ast.iter_child_nodes(tree):
            if isinstance(node, ast.FunctionDef):
                process_node(node, root_id)

        for caller_id, func_node in function_records:
            for child in ast.walk(func_node):
                if isinstance(child, ast.Call):
                    callee = get_call_name(child.func)
                    if callee and callee in node_ids:
                        callee_id = node_ids[callee]
                        if callee_id != caller_id:
                            add_link(caller_id, callee_id, "calls")

        return {"nodes": nodes, "links": links}

    except Exception as e:
        return {"error": f"Error parsing Python code: {str(e)}"}

def generate_js_ts_diagram(code, language, root_label=None):
    nodes = []
    links = []
    node_ids = {}
    link_keys = set()
    counter = [0]
    function_bodies = []

    def get_node_id(name):
        if name not in node_ids:
            node_ids[name] = f"node{counter[0]}"
            counter[0] += 1
        return node_ids[name]

    def add_link(source, target, link_type="contains"):
        key = (source, target, link_type)
        if source == target or key in link_keys:
            return
        link_keys.add(key)
        links.append({"source": source, "target": target, "type": link_type})

    def add_node(name, node_type="", details="", parent=None, body_text=None):
        node_id = get_node_id(name)

        if body_text and node_type in ("Function", "Method") and is_react_component(body_text):
            node_type = "Component"

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
            add_link(parent, node_id, "contains")

        if body_text and node_type in ("Function", "Method", "Component"):
            function_bodies.append((name, node_id, body_text))

        return node_id

    label = root_label or f"{language} Structure"
    root_id = add_node(label, "Root", "Main program structure")

    class_pattern = r'(?:export\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([^{]+))?\s*{\s*(?:\/\*\*([^*]*)\*\/)?\s*'
    function_pattern = r'(?:export\s+)?(?:async\s+)?(?:function|const)\s+(\w+)\s*[=]?\s*(?:\(([^)]*)\))(?:\s*:\s*([^{=]+))?\s*(?:=>|{)\s*(?:\/\*\*([^*]*)\*\/)?\s*'

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

        class_body_text = extract_braced_body(code, match.end())
        method_pattern = r'(?:async\s+)?(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^{=]+))?\s*{?\s*(?:\/\*\*([^*]*)\*\/)?\s*'

        for method_match in re.finditer(method_pattern, class_body_text):
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

            method_body = extract_braced_body(class_body_text, method_match.end())
            add_node(method_name, "Method", "\\n".join(method_details), class_id, method_body)

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

            body_start = match.end()
            body_text = extract_braced_body(code, body_start)
            add_node(name, "Function", "\\n".join(details), root_id, body_text)

    known_names = {n["name"] for n in nodes if n["type"] in ("Function", "Method", "Component")}
    for name, caller_id, body in function_bodies:
        for other in known_names:
            if other != name and f"{other}(" in body:
                if other in node_ids:
                    add_link(caller_id, node_ids[other], "calls")

    return {"nodes": nodes, "links": links}

def generate_cpp_diagram(code, root_label="C++ Structure"):
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
            links.append({"source": parent, "target": node_id, "type": "contains"})

        return node_id

    root_id = add_node(root_label, "Root", "Main program structure")

    class_pattern = r'class\s+(\w+)(?:\s*:\s*(?:public|private|protected)\s+([^{]+))?\s*{\s*(?:\/\*\*([^*]*)\*\/)?\s*'
    function_pattern = r'(?:virtual\s+)?(?:static\s+)?(\w+)\s+(\w+)\s*\(([^)]*)\)\s*(?:const|noexcept|override|final|)?\s*(?:{|;)\s*(?:\/\*\*([^*]*)\*\/)?\s*'

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

        class_body = code[match.end():].split("\n")
        for line in class_body:
            method_match = re.search(function_pattern, line)
            if method_match:
                return_type = method_match.group(1)
                method_name = method_match.group(2)
                params = method_match.group(3)
                method_doc = method_match.group(4)

                if method_name and method_name not in ['if', 'for', 'while', 'switch']:
                    method_details = [f"Return Type: {return_type}"]
                    if params:
                        method_details.append(f"Parameters: ({params})")
                    if method_doc:
                        method_details.append(f"Description: {method_doc.strip()}")

                    add_node(method_name, "Method", "\\n".join(method_details), class_id)

    for match in re.finditer(function_pattern, code):
        return_type = match.group(1)
        name = match.group(2)
        params = match.group(3)
        doc = match.group(4)

        if name and name not in ['if', 'for', 'while', 'switch']:
            details = [f"Return Type: {return_type}"]
            if params:
                details.append(f"Parameters: ({params})")
            if doc:
                details.append(f"Description: {doc.strip()}")

            add_node(name, "Function", "\\n".join(details), root_id)

    return {"nodes": nodes, "links": links}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No language provided"}))
        sys.exit(1)

    language = sys.argv[1]
    filename = sys.argv[2] if len(sys.argv) > 2 else None
    if filename:
        filename = os.path.basename(filename)

    code = sys.stdin.read()

    if not code:
        print(json.dumps({"error": "No code provided"}))
        sys.exit(1)

    diagram = parse_code(code, language, filename)
    print(json.dumps(diagram))
