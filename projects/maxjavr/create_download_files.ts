import * as fs from 'fs'
import * as path from 'path'

const INPUT_FILE = 'd:\\Coding\\home-lab\\projects\\maxjavr\\data-store\\.new_maxjavr\\missing_download_files.jsonl'
const OUTPUT_DIR = 'd:\\Coding\\home-lab\\projects\\maxjavr\\data-store\\.new_maxjavr\\__OBJ__download_file'

interface DownloadFileData {
    code_dir: string
    type: string
    keyword_dir: string
}

export const createDownloadFiles = (): void => {
    if (!fs.existsSync(INPUT_FILE)) {
        console.error(`Input file not found: ${INPUT_FILE}`)
        return
    }

    const content = fs.readFileSync(INPUT_FILE, 'utf-8')
    const lines = content.trim().split('\n')

    const existingFiles = new Set<string>()
    if (fs.existsSync(OUTPUT_DIR)) {
        const files = fs.readdirSync(OUTPUT_DIR)
        for (const file of files) {
            existingFiles.add(file.toLowerCase())
        }
    }

    let created = 0
    let skipped = 0

    for (const line of lines) {
        if (!line.trim()) continue

        const data: DownloadFileData = JSON.parse(line)
        const fileName = `${data.code_dir}.json`
        const filePath = path.join(OUTPUT_DIR, fileName)

        if (existingFiles.has(fileName.toLowerCase())) {
            console.warn(`Warning: File already exists (skipping): ${fileName}`)
            skipped++
            continue
        }

        const fileContent = {
            type: data.type,
            code_dir: data.code_dir,
            keyword_dir: data.keyword_dir
        }

        fs.writeFileSync(filePath, JSON.stringify(fileContent, null, 2), 'utf-8')
        console.log(`Created: ${fileName}`)
        created++
    }

    console.log(`\nTotal: ${lines.length}, Created: ${created}, Skipped: ${skipped}`)
}

if (require.main === module) {
    console.log('Creating download files...\n')
    createDownloadFiles()
}
