import * as fs from 'fs'
import * as path from 'path'

const TREE_FILE_PATH = path.join(__dirname, 'data-store', '.new_maxjavr', '目录树', '_EXTRA20260117201359_目录树.txt')

export interface TreeNode {
    name: string
    type: 'file' | 'directory'
    path: string
    children?: TreeNode[]
    level: number
}

export interface DownloadFileData {
    code_dir: string
    type: string
    keyword_dir: string
}

const DOWNLOAD_FILE_DIR = path.join(__dirname, 'data-store', '.new_maxjavr', '__OBJ__download_file')

export const parseTreeFile = (filePath: string = TREE_FILE_PATH): TreeNode[] => {
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`)
        return []
    }

    const content = fs.readFileSync(filePath, { encoding: 'utf16le' })
    const lines = content.split('\n').filter(line => line.trim())

    const root: TreeNode[] = []
    const stack: { node: TreeNode; level: number }[] = []

    for (const line of lines) {
        const level = countIndent(line)
        const name = extractName(line)

        if (!name) continue

        const isDirectory = !name.includes('.')
        const cleanName = name

        const node: TreeNode = {
            name: cleanName,
            type: isDirectory ? 'directory' : 'file',
            path: '',
            level: level
        }

        while (stack.length > 0 && stack[stack.length - 1].level >= level) {
            stack.pop()
        }

        if (stack.length === 0) {
            root.push(node)
        } else {
            const parent = stack[stack.length - 1].node
            node.path = path.join(parent.path, node.name)
            parent.children = parent.children || []
            parent.children.push(node)
        }

        if (isDirectory) {
            node.path = node.path || node.name
            stack.push({ node, level })
        }
    }

    assignPaths(root, '')

    return root
}

const extractName = (line: string): string => {
    for (let i = 0; i < line.length; i++) {
        const char = line[i]
        const code = line.charCodeAt(i)
        if (char !== ' ' && char !== '|' && char !== '　' && char !== '─' && char !== '├' && char !== '└' && char !== '-') {
            if (code >= 0x4e00 && code <= 0x9fff) {
                return line.substring(i).replace(/^[│｜|\s├└─-]+/, '').trim()
            }
            if ((code >= 0x61 && code <= 0x7a) || (code >= 0x41 && code <= 0x5a) || (code >= 0x30 && code <= 0x39)) {
                return line.substring(i).replace(/^[│｜|\s├└─-]+/, '').trim()
            }
            return line.substring(i).replace(/^[│｜|\s├└─-]+/, '').trim()
        }
    }
    return line.replace(/^[│｜|\s├└─-]+/, '').trim()
}

const countIndent = (line: string): number => {
    let level = 0
    let i = 0

    while (i < line.length) {
        if (line[i] === '|' || line[i] === ' ' || line[i] === '　') {
            if (line[i] === '|' && i + 1 < line.length && (line[i + 1] === ' ' || line[i + 1] === '　')) {
                level++
                i += 2
            } else if (line[i] === '|' && i + 1 < line.length && line[i + 1] === '─') {
                level++
                i += 2
                while (i < line.length && line[i] === '─') {
                    i++
                }
            } else if (line[i] === ' ') {
                i++
            } else if (line[i] === '　') {
                i++
            } else {
                i++
            }
        } else {
            break
        }
    }

    return level
}

const assignPaths = (nodes: TreeNode[], basePath: string): void => {
    for (const node of nodes) {
        node.path = path.join(basePath, node.name)
        if (node.children) {
            assignPaths(node.children, node.path)
        }
    }
}

export const findFiles = (nodes: TreeNode[], extension?: string): TreeNode[] => {
    const files: TreeNode[] = []

    const search = (nodeList: TreeNode[]) => {
        for (const node of nodeList) {
            if (node.type === 'file') {
                if (!extension || node.name.endsWith(extension)) {
                    files.push(node)
                }
            }
            if (node.children) {
                search(node.children)
            }
        }
    }

    search(nodes)
    return files
}

export const findDirectories = (nodes: TreeNode[], nameContains?: string): TreeNode[] => {
    const dirs: TreeNode[] = []

    const search = (nodeList: TreeNode[]) => {
        for (const node of nodeList) {
            if (node.type === 'directory') {
                if (!nameContains || node.name.includes(nameContains)) {
                    dirs.push(node)
                }
                if (node.children) {
                    search(node.children)
                }
            }
        }
    }

    search(nodes)
    return dirs
}

const cleanKeywordDir = (name: string): string => {
    return name.replace(/\(\d+\)$/, '').replace(/^[│｜|\s├└─-]+/, '').trim()
}

export const printTree = (nodes: TreeNode[], prefix: string = ''): void => {
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i]
        const isLast = i === nodes.length - 1
        const connector = isLast ? '└── ' : '├── '
        const typeIcon = node.type === 'directory' ? '📁 ' : '📄 '
        console.log(`${prefix}${connector}${typeIcon}${node.name}`)

        if (node.children && node.children.length > 0) {
            const newPrefix = prefix + (isLast ? '    ' : '│   ')
            printTree(node.children, newPrefix)
        }
    }
}

export const parseDownloadFilesFromTree = (tree: TreeNode[]): DownloadFileData[] => {
    const result: DownloadFileData[] = []
    const seenCodeDirs = new Map<string, string>()

    const buildPathMap = (nodes: TreeNode[], currentPath: string = ''): void => {
        for (const node of nodes) {
            const nodePath = currentPath ? path.join(currentPath, node.name) : node.name
            const pathParts = nodePath.split(/[\\/]/).filter(Boolean)

            const isVideoFile = /\.(mp4|mkv|avi|mov|wmv|flv|webm)$/i.test(node.name)
            const isFile = isVideoFile && pathParts.length >= 3

            if (isFile) {
                const firstDotIndex = node.name.indexOf('.')
                const typeFull = firstDotIndex > 0 ? node.name.substring(firstDotIndex + 1) : ''
                const codeDir = pathParts[pathParts.length - 2]
                const keywordDir = cleanKeywordDir(pathParts[pathParts.length - 3])

                if (seenCodeDirs.has(codeDir)) {
                    const existingType = seenCodeDirs.get(codeDir)!
                    if (existingType !== typeFull) {
                        console.warn(`Warning: ${codeDir} has multiple types - "${existingType}" and "${typeFull}"`)
                    }
                } else {
                    seenCodeDirs.set(codeDir, typeFull)
                    result.push({
                        code_dir: codeDir,
                        type: typeFull,
                        keyword_dir: keywordDir
                    })
                }
            }

            if (node.children) {
                buildPathMap(node.children, nodePath)
            }
        }
    }

    buildPathMap(tree)

    return result
}

if (require.main === module) {
    console.log('Parsing tree file...\n')
    const tree = parseTreeFile()
    const data = parseDownloadFilesFromTree(tree)

    const downloadFileDir = DOWNLOAD_FILE_DIR
    const existingCodeDirs = new Set<string>()
    if (fs.existsSync(downloadFileDir)) {
        const files = fs.readdirSync(downloadFileDir)
        for (const file of files) {
            const fileName = file.replace(/\.json$/i, '')
            existingCodeDirs.add(fileName.toLowerCase())
        }
    }

    const missingData = data.filter(item => !existingCodeDirs.has(item.code_dir.toLowerCase()))

    const totalData = data.length
    const missingCount = missingData.length
    const existingCount = totalData - missingCount

    console.log(`Total: ${totalData}, Existing: ${existingCount}, New: ${missingCount}\n`)

    const outputDir = path.join(__dirname, 'data-store', '.new_maxjavr')
    const outputFile = path.join(outputDir, 'missing_download_files.jsonl')
    if (fs.existsSync(outputFile)) {
        fs.unlinkSync(outputFile)
    }
    for (const item of missingData) {
        fs.appendFileSync(outputFile, JSON.stringify(item) + '\n', 'utf-8')
    }
    console.log(`Output written to: ${outputFile}\n`)

    for (const item of missingData) {
        console.log(`code_dir: ${item.code_dir}`)
        console.log(`  type: ${item.type}`)
        console.log(`  keyword_dir: ${item.keyword_dir}`)
        console.log('')
    }
}
