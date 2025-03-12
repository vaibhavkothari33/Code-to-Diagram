import ast
import json
import sys

def traverse(node, parent_id=None, nodes=None, edges=None):
    if nodes is None:
        nodes = []
    if edges is None:
        edges = []

    node_id = f"node{len(nodes)}"
    nodes.append(f'{node_id}[{type(node).__name__}]')

    if parent_id:
        edges.append(f"{parent_id} --> {node_id}")

    for child in ast.iter_child_nodes(node):
        traverse(child, node_id, nodes, edges)

    return nodes, edges

def generate_flowchart(code):
    try:
        tree = ast.parse(code)
        nodes, edges = traverse(tree)
        return f"graph TD;\n{';\n'.join(nodes)}\n{';\n'.join(edges)}"
    except Exception as e:
        return str(e)

if __name__ == "__main__":
    # Check if a language argument is passed
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No language provided"}))
        sys.exit(1)

    language = sys.argv[1]  
    input_code = sys.stdin.read().strip()

    if not input_code:
        print(json.dumps({"error": "No code provided"}))
        sys.exit(1)

    if language == "python":
        flowchart = generate_flowchart(input_code)
    else:
        flowchart = f"Unsupported language: {language}"

    print(json.dumps({"diagram": flowchart}))
