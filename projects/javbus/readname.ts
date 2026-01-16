import * as fs from 'fs';
import * as path from 'path';

/**
 * 读取目录下所有 .mp4、.mkv、.avi 文件，并将文件名（每行一个）写入输出文件
 * @param dirPath 要扫描的目录路径，默认为当前目录 '.'
 * @param outputPath 输出文件名列表的文件路径，默认为 'video_files.txt'
 */
function listVideoFiles(dirPath: string = '.', outputPath: string = 'video_files.txt'): void {
    try {
        const files = fs.readdirSync(dirPath);

        const videoFiles: string[] = [];

        for (const file of files) {
            const fullPath = path.join(dirPath, file);
            const stat = fs.statSync(fullPath);

            // 只处理文件（排除目录）
            if (stat.isFile()) {
                const ext = path.extname(file).toLowerCase();
                if (['.mp4', '.mkv', '.avi'].includes(ext)) {
                    videoFiles.push(file); // 只保存文件名，不保存完整路径
                }
            }
        }

        // 按文件名排序（可选，使输出更有序）
        videoFiles.sort();

        // 每行一个文件名，最后加一个换行符
        const content = videoFiles.join('\n') + (videoFiles.length > 0 ? '\n' : '');

        fs.writeFileSync(outputPath, content, 'utf-8');

        console.log(`成功：找到 ${videoFiles.length} 个视频文件，已写入 ${outputPath}`);
    } catch (err) {
        console.error('发生错误：', err);
        throw err;
    }
}

function removeUnuseText(name: string) {
    return name.replace('big2048.com', '').replace('hhd800.com', '').replace('guochan2048.com', '')
}

/**
 * 从 txt 文件中逐行读取，解析出其中的 JAV 番号（AV 代码）
 * - 忽略所有以 FC2 开头的番号（如 FC2-PPV-XXXX）
 * - 只提取标准格式的番号（以 - + 数字结尾）
 * - 将结果以 JSONL 格式输出到新文件
 *   每行一个 JSON 对象：{ "filename": "原文件名完整字符串", "code": "提取的大写番号" }
 * - 如果一个文件名包含多个有效番号，会输出多行（每行一个番号）
 * - 只输出有有效番号的文件行
 * - 结果会按原文件顺序输出（未排序）
 */
function extractJAVCodesToJSONL(
    inputPath: string = 'video_files.txt',
    outputPath: string = 'jav_codes.txt'
): void {
    try {
        const content = fs.readFileSync(inputPath, 'utf-8');
        const lines = content.split(/\r?\n/);

        const results: { filename: string; code: string }[] = [];

        // 原正则：匹配标准 JAV 番号（如 SONE-563、MIDV-258-C 等）
        // 不会匹配字幕后缀 -C/ch 等
        const regex = /([A-Z]+(?:-[A-Z0-9]+)*-\d{3,8})/gi;

        // 新增补充正则：修复无连字符、带 _/. 、或紧挨数字的变体
        // 示例：
        //   dccdom.com@MIDA064C.mp4 → MIDA-064
        //   ONED_820A.mp4 → ONED-820
        //   ONED427.avi → ONED-427
        //   （会忽略后缀字母如 C/A/ch 等）
        const fallbackRegex = /([A-Z]+)[_.-]?(\d{3,8})(?:[A-Za-z]*)?/gi;

        for (const line of lines) {
            let originalFilename = line.trim();
            if (!originalFilename) continue;

            // 预处理：如果文件名包含 '@'，删除 '@' 之前的内容（包括 @），只保留后面的部分用于匹配
            // 例如：dccdom.com@MIDA064C.mp4 → MIDA064C.mp4
            //      4k2.com@ekdv-777.mp4 → ekdv-777.mp4
            let matchFilename = originalFilename;
            const atIndex = originalFilename.lastIndexOf('@');
            if (atIndex !== -1) {
                matchFilename = originalFilename.substring(atIndex + 1);
            }

            console.log(matchFilename)
            // 收集该文件名所有唯一有效番号（去重）
            const fileCodes = new Set<string>();

            // 首先尝试原正则（在预处理后的字符串上匹配）
            const matches = removeUnuseText(matchFilename).match(regex);
            if (matches) {
                for (const match of matches) {
                    const code = match.toUpperCase();
                    if (code.startsWith('FC2')) continue;
                    fileCodes.add(code);
                }
            }

            // 如果原正则没有提取到，再尝试补充正则（也在预处理后的字符串上）
            if (fileCodes.size === 0) {
                const fallbackIter = removeUnuseText(matchFilename).matchAll(fallbackRegex);
                for (const match of fallbackIter) {

                    const prefix = match[1].toUpperCase();
                    const num = match[2];

                    console.log(prefix, num)
                    const code = `${prefix}-${num}`;
                    if (code.startsWith('FC2')) continue;
                    fileCodes.add(code);
                }
            }

            // 如果提取到番号，推入结果（使用原始文件名 originalFilename）
            if (fileCodes.size > 0) {
                for (const code of fileCodes) {

                    console.log({ originalFilename, code })
                    results.push({ filename: originalFilename, code });
                }
            }
        }
        // 写入 JSONL 文件（每行一个 JSON 对象）
        const jsonlContent = results.map((r) => JSON.stringify(r)).join('\n') + '\n';
        fs.writeFileSync(outputPath, jsonlContent, 'utf-8');

        console.log(`提取完成，共 ${results.length} 条记录，已写入 ${outputPath}`);
    } catch (err) {
        console.error('处理失败:', err);
    }
}

/**
 * 从 jsonl 文件中逐行读取文件名和番号，将原文件重命名为 【AV】{番号}.{idx}.{后缀名} 其中 idx 从 0 开始，有重复的番号则向上递增
 * @param jsonlPath jsonl 文件地址，包含文件名和番号
 * @param fileDir 原文件所在目录
 * @param outputPath 输出文件目录
 */

function renammeByJavJsonl(jsonlPath: string, fileDir: string, outputPath: string) {

    try {
        // 确保输出目录存在
        if (!fs.existsSync(outputPath)) {
            fs.mkdirSync(outputPath, { recursive: true });
        }

        const content = fs.readFileSync(jsonlPath, 'utf-8');
        const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');

        if (lines.length === 0) {
            console.log('JSONL 文件为空，无需重命名');
            return;
        }

        const entries: { filename: string; code: string }[] = lines.map(line => JSON.parse(line));

        // 处理：每个 filename 只取第一个提取到的 code（防止极少数文件名匹配多个 code 的情况）
        const filenameToCode = new Map<string, string>();
        const codeToFilenames = new Map<string, string[]>();

        for (const { filename, code } of entries) {
            if (!filenameToCode.has(filename)) {
                filenameToCode.set(filename, code);

                if (!codeToFilenames.has(code)) {
                    codeToFilenames.set(code, []);
                }
                codeToFilenames.get(code)!.push(filename);
            } else {
                console.warn(`文件名 "${filename}" 匹配到多个番号，已存在 ${filenameToCode.get(filename)}，忽略新匹配 ${code}`);
            }
        }

        let renamedCount = 0;

        for (const [code, filenames] of codeToFilenames) {
            let idx = 0;

            for (const filename of filenames) {
                const oldPath = path.join(fileDir, filename);

                if (!fs.existsSync(oldPath)) {
                    console.warn(`原文件不存在，跳过: ${oldPath}`);
                    idx++;
                    continue;
                }

                const ext = path.extname(filename);

                // 始终带 .idx，从 0 开始（即使只有一个文件也带 .0）
                const baseName = `【AV】${code}.${idx}`;

                const newFilename = `${baseName}${ext}`;
                const newPath = path.join(outputPath, newFilename);

                // 简单检查目标文件是否已存在（极少冲突）
                if (fs.existsSync(newPath)) {
                    console.warn(`目标文件已存在，跳过或手动处理: ${newPath}`);
                    idx++;
                    continue;
                }

                fs.renameSync(oldPath, newPath);
                console.log(`重命名并移动: ${filename} → ${newFilename}`);

                renamedCount++;
                idx++;
            }
        }

        console.log(`重命名完成，共处理 ${renamedCount} 个文件，已移动到 ${outputPath}`);
    } catch (err) {
        console.error('重命名过程发生错误:', err);
    }
}


const deal = (dirPath: string) => {
    const outputPath = path.resolve(dirPath, '.output', new Date().toISOString().replaceAll(':', '-'))
    if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true })
    }


    const videoFilesPath = path.resolve(outputPath, 'video_files.txt')
    listVideoFiles(dirPath, videoFilesPath)

    const javJsonlPath = path.resolve(outputPath, 'jav_codes.jsonl')
    extractJAVCodesToJSONL(videoFilesPath, javJsonlPath)
    
    renammeByJavJsonl(javJsonlPath, dirPath, outputPath)
}



deal(`\\\\N2\\f 共享\\115`)