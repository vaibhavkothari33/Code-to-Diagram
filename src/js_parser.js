const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const path = require('path');

const JS_LANGUAGES = new Set([
    'javascript',
    'typescript',
    'javascriptreact',
    'typescriptreact',
    'jsx',
    'tsx',
]);

const COLORS = {
    Root: { fill: '#37474F', text: '#FFFFFF' },
    Class: { fill: '#2E7D32', text: '#FFFFFF' },
    Function: { fill: '#1565C0', text: '#FFFFFF' },
    Method: { fill: '#0277BD', text: '#FFFFFF' },
    Component: { fill: '#7C3AED', text: '#FFFFFF' },
    Import: { fill: '#6D4C41', text: '#FFFFFF' },
};

function isJsLanguage(languageId) {
    return JS_LANGUAGES.has(languageId);
}

function getBabelPlugins(languageId) {
    const plugins = ['jsx'];
    if (languageId === 'typescript' || languageId === 'typescriptreact' || languageId === 'tsx') {
        plugins.push('typescript');
    }
    return plugins;
}

function hasJsxInNode(node) {
    if (!node) return false;
    switch (node.type) {
        case 'JSXElement':
        case 'JSXFragment':
            return true;
        case 'ParenthesizedExpression':
            return hasJsxInNode(node.expression);
        case 'ConditionalExpression':
            return hasJsxInNode(node.consequent) || hasJsxInNode(node.alternate);
        case 'LogicalExpression':
            return hasJsxInNode(node.left) || hasJsxInNode(node.right);
        default:
            return false;
    }
}

function functionReturnsJsx(fnPath) {
    let returnsJsx = false;
    const bodyPath = fnPath.get('body');
    if (!bodyPath.node) {
        return false;
    }

    bodyPath.traverse({
        ReturnStatement(returnPath) {
            if (hasJsxInNode(returnPath.node.argument)) {
                returnsJsx = true;
            }
        },
        Function(innerPath) {
            innerPath.skip();
        },
    });

    return returnsJsx;
}

function getCalleeName(callee) {
    if (!callee) return null;
    if (callee.type === 'Identifier') {
        return callee.name;
    }
    if (callee.type === 'MemberExpression' && !callee.computed) {
        if (callee.property.type === 'Identifier') {
            return callee.property.name;
        }
    }
    return null;
}

function getJsxElementName(nameNode) {
    if (!nameNode) return null;
    if (nameNode.type === 'JSXIdentifier') {
        return nameNode.name;
    }
    if (nameNode.type === 'JSXMemberExpression') {
        return getJsxElementName(nameNode.property);
    }
    return null;
}

function isComponentTag(name) {
    return name && name[0] === name[0].toUpperCase() && name[0] !== name[0].toLowerCase();
}

function formatParams(params) {
    return params
        .map((p) => {
            if (p.type === 'Identifier') return p.name;
            if (p.type === 'AssignmentPattern' && p.left.type === 'Identifier') {
                return p.left.name;
            }
            if (p.type === 'RestElement' && p.argument.type === 'Identifier') {
                return `...${p.argument.name}`;
            }
            return null;
        })
        .filter(Boolean)
        .join(', ');
}

function parseJsTsDiagram(code, languageId, fileName) {
    const nodes = [];
    const links = [];
    const linkSet = new Set();
    const nameToId = new Map();
    const moduleNodes = new Map();
    let counter = 0;

    function nextId() {
        return `node${counter++}`;
    }

    function addLink(source, target, type) {
        if (!source || !target || source === target) return;
        const key = `${source}|${target}|${type}`;
        if (linkSet.has(key)) return;
        linkSet.add(key);
        links.push({ source, target, type });
    }

    function registerName(name, id) {
        if (name) {
            nameToId.set(name, id);
        }
    }

    function addNode(name, nodeType, details = '', parentId = null) {
        const id = nextId();
        const colors = COLORS[nodeType] || COLORS.Function;
        nodes.push({
            id,
            name,
            type: nodeType,
            color: colors.fill,
            textColor: colors.text,
            details,
        });
        registerName(name, id);
        if (parentId) {
            addLink(parentId, id, 'contains');
        }
        return id;
    }

    function getOrCreateModuleNode(modulePath) {
        if (moduleNodes.has(modulePath)) {
            return moduleNodes.get(modulePath);
        }
        const id = addNode(modulePath, 'Import', 'External dependency');
        moduleNodes.set(modulePath, id);
        return id;
    }

    const rootLabel = path.basename(fileName || 'module.js');
    const rootId = addNode(rootLabel, 'Root', 'File structure');

    let ast;
    try {
        ast = parser.parse(code, {
            sourceType: 'unambiguous',
            plugins: getBabelPlugins(languageId),
            errorRecovery: true,
        });
    } catch (err) {
        return { error: `Parse error: ${err.message}` };
    }

    const functionBodies = [];

    function registerFunction(name, fnPath, parentId, isMethod) {
        if (!name) return null;

        const isComponent = functionReturnsJsx(fnPath);
        let nodeType;
        if (isComponent) {
            nodeType = 'Component';
        } else if (isMethod) {
            nodeType = 'Method';
        } else {
            nodeType = 'Function';
        }

        const params = formatParams(fnPath.node.params || []);
        const details = params ? `Parameters: (${params})` : '';
        const id = addNode(name, nodeType, details, parentId);

        const bodyPath = fnPath.get('body');
        if (bodyPath.node) {
            functionBodies.push({ bodyPath, scopeId: id });
        }
        return id;
    }

    traverse(ast, {
        ImportDeclaration(importPath) {
            const source = importPath.node.source.value;
            const moduleId = getOrCreateModuleNode(source);
            addLink(rootId, moduleId, 'imports');

            for (const spec of importPath.node.specifiers) {
                let localName = null;
                if (spec.type === 'ImportDefaultSpecifier' || spec.type === 'ImportNamespaceSpecifier') {
                    localName = spec.local.name;
                } else if (spec.type === 'ImportSpecifier') {
                    localName = spec.local.name;
                }
                if (localName) {
                    const bindingId = addNode(localName, 'Import', `from '${source}'`, rootId);
                    registerName(localName, bindingId);
                }
            }
        },

        ClassDeclaration(classPath) {
            const name = classPath.node.id?.name;
            if (!name) return;

            let details = '';
            const superClass = classPath.node.superClass;
            if (superClass?.type === 'Identifier') {
                details = `Extends: ${superClass.name}`;
            }

            const classId = addNode(name, 'Class', details, rootId);

            if (superClass?.type === 'Identifier' && nameToId.has(superClass.name)) {
                addLink(classId, nameToId.get(superClass.name), 'calls');
            }

            classPath.get('body.body').forEach((memberPath) => {
                if (memberPath.isClassMethod() || memberPath.isClassPrivateMethod()) {
                    const methodName = memberPath.node.key?.name || memberPath.node.key?.value;
                    if (methodName) {
                        registerFunction(methodName, memberPath, classId, true);
                    }
                } else if (memberPath.isClassProperty() || memberPath.isClassPrivateProperty()) {
                    const propName = memberPath.node.key?.name || memberPath.node.key?.value;
                    const value = memberPath.get('value');
                    if (propName && value.isFunction()) {
                        registerFunction(propName, value, classId, true);
                    }
                }
            });
        },

        FunctionDeclaration(fnPath) {
            const name = fnPath.node.id?.name;
            if (name) {
                registerFunction(name, fnPath, rootId, false);
            }
        },

        VariableDeclarator(varPath) {
            const id = varPath.node.id;
            const init = varPath.get('init');
            if (!id || !init.node) return;

            if (id.type === 'Identifier' && init.isFunction()) {
                registerFunction(id.name, init, rootId, false);
            }
        },

        ExportDefaultDeclaration(exportPath) {
            const declaration = exportPath.get('declaration');
            if (declaration.isFunction()) {
                const name = declaration.node.id?.name || path.basename(rootLabel, path.extname(rootLabel));
                registerFunction(name, declaration, rootId, false);
            } else if (declaration.isIdentifier()) {
                registerName(declaration.node.name, nameToId.get(declaration.node.name));
            }
        },
    });

    function analyzeBodyCalls(bodyPath, scopeId) {
        const registeredBodies = new Set(functionBodies.map((f) => f.bodyPath.node));

        bodyPath.traverse({
            CallExpression(callPath) {
                const targetName = getCalleeName(callPath.node.callee);
                if (targetName && nameToId.has(targetName)) {
                    addLink(scopeId, nameToId.get(targetName), 'calls');
                }
            },
            NewExpression(newPath) {
                const targetName = getCalleeName(newPath.node.callee);
                if (targetName && nameToId.has(targetName)) {
                    addLink(scopeId, nameToId.get(targetName), 'calls');
                }
            },
            JSXOpeningElement(jsxPath) {
                const tagName = getJsxElementName(jsxPath.node.name);
                if (isComponentTag(tagName) && nameToId.has(tagName)) {
                    addLink(scopeId, nameToId.get(tagName), 'calls');
                }
            },
            Function(innerPath) {
                if (registeredBodies.has(innerPath.node)) {
                    innerPath.skip();
                }
            },
        });
    }

    for (const { bodyPath, scopeId } of functionBodies) {
        analyzeBodyCalls(bodyPath, scopeId);
    }

    // Top-level calls (module scope)
    traverse(ast, {
        Program(programPath) {
            programPath.get('body').forEach((stmtPath) => {
                if (
                    stmtPath.isFunctionDeclaration() ||
                    stmtPath.isClassDeclaration() ||
                    stmtPath.isExportNamedDeclaration() ||
                    stmtPath.isExportDefaultDeclaration()
                ) {
                    return;
                }
                analyzeBodyCalls(stmtPath, rootId);
            });
        },
    });

    if (nodes.length <= 1) {
        return { error: 'No code structure detected' };
    }

    return { nodes, links };
}

module.exports = {
    isJsLanguage,
    parseJsTsDiagram,
};
