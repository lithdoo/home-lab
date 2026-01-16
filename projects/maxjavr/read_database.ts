import { Database } from 'bun:sqlite';
import * as fs from 'fs';
import * as path from 'path';

const DB_PATH = 'd:\\Coding\\home-lab\\projects\\maxjavr\\data-store\\.maxjavr_data\\index.db';
const OUTPUT_DIR = 'd:\\Coding\\home-lab\\projects\\maxjavr\\data-store\\.new_maxjavr\\__REF__video_info';
const DOWNLOAD_FILE_OUTPUT_DIR = 'd:\\Coding\\home-lab\\projects\\maxjavr\\data-store\\.new_maxjavr\\download_file';
const VIDEO_PAGE_OUTPUT_DIR = 'd:\\Coding\\home-lab\\projects\\maxjavr\\data-store\\.new_maxjavr\\video_page';
const KEYWORD_OUTPUT_DIR = 'd:\\Coding\\home-lab\\projects\\maxjavr\\data-store\\.new_maxjavr\\keyword';

export function exportVideoInfoToJson(): void {
  if (!fs.existsSync(DB_PATH)) {
    console.error(`Database file not found: ${DB_PATH}`);
    return;
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const db = new Database(DB_PATH);
  
  const query = db.query('SELECT * FROM __REF__video_info');
  const rows:any = query.all();
  
  let successCount = 0;
  let errorCount = 0;

  for (const row of rows) {
    try {
      const videoCode = row.video_code;
      if (!videoCode) {
        console.warn('Skipping row with missing video_code');
        errorCount++;
        continue;
      }

      const filePath = path.join(OUTPUT_DIR, `${videoCode}.json`);
      fs.writeFileSync(filePath, JSON.stringify(row, null, 2), 'utf-8');
      successCount++;
    } catch (err) {
      console.error(`Error writing file for video_code ${row.video_code}:`, err);
      errorCount++;
    }
  }

  db.close();

  console.log(`Export completed:`);
  console.log(`  - Successfully exported: ${successCount}`);
  console.log(`  - Errors: ${errorCount}`);
  console.log(`  - Output directory: ${OUTPUT_DIR}`);
}

export function exportDownloadFileToJson(): void {
  if (!fs.existsSync(DB_PATH)) {
    console.error(`Database file not found: ${DB_PATH}`);
    return;
  }

  if (!fs.existsSync(DOWNLOAD_FILE_OUTPUT_DIR)) {
    fs.mkdirSync(DOWNLOAD_FILE_OUTPUT_DIR, { recursive: true });
  }

  const db = new Database(DB_PATH);
  
  const query = db.query('SELECT * FROM download_file');
  const rows:any = query.all();
  
  let successCount = 0;
  let errorCount = 0;

  for (const row of rows) {
    try {
      const codeDir = row.code_dir;
      if (!codeDir) {
        console.warn('Skipping row with missing code_dir');
        errorCount++;
        continue;
      }

      const filePath = path.join(DOWNLOAD_FILE_OUTPUT_DIR, `${codeDir}.json`);
      fs.writeFileSync(filePath, JSON.stringify(row, null, 2), 'utf-8');
      successCount++;
    } catch (err) {
      console.error(`Error writing file for code_dir ${row.code_dir}:`, err);
      errorCount++;
    }
  }

  db.close();

  console.log(`Download file export completed:`);
  console.log(`  - Successfully exported: ${successCount}`);
  console.log(`  - Errors: ${errorCount}`);
  console.log(`  - Output directory: ${DOWNLOAD_FILE_OUTPUT_DIR}`);
}

export function exportVideoPageToJson(): void {
  if (!fs.existsSync(DB_PATH)) {
    console.error(`Database file not found: ${DB_PATH}`);
    return;
  }

  if (!fs.existsSync(VIDEO_PAGE_OUTPUT_DIR)) {
    fs.mkdirSync(VIDEO_PAGE_OUTPUT_DIR, { recursive: true });
  }

  const db = new Database(DB_PATH);
  
  const query = db.query('SELECT * FROM video_page');
  const rows:any = query.all();
  
  let successCount = 0;
  let errorCount = 0;

  for (const row of rows) {
    try {
      const code = row.code;
      if (!code) {
        console.warn('Skipping row with missing code');
        errorCount++;
        continue;
      }

      const filePath = path.join(VIDEO_PAGE_OUTPUT_DIR, `${code}.json`);
      fs.writeFileSync(filePath, JSON.stringify(row, null, 2), 'utf-8');
      successCount++;
    } catch (err) {
      console.error(`Error writing file for code ${row.code}:`, err);
      errorCount++;
    }
  }

  db.close();

  console.log(`Video page export completed:`);
  console.log(`  - Successfully exported: ${successCount}`);
  console.log(`  - Errors: ${errorCount}`);
  console.log(`  - Output directory: ${VIDEO_PAGE_OUTPUT_DIR}`);
}

export function exportKeywordToJson(): void {
  if (!fs.existsSync(DB_PATH)) {
    console.error(`Database file not found: ${DB_PATH}`);
    return;
  }

  if (!fs.existsSync(KEYWORD_OUTPUT_DIR)) {
    fs.mkdirSync(KEYWORD_OUTPUT_DIR, { recursive: true });
  }

  const db = new Database(DB_PATH);
  
  const query = db.query('SELECT * FROM keyword');
  const rows:any = query.all();
  
  let successCount = 0;
  let errorCount = 0;

  for (const row of rows) {
    try {
      const text = row.text;
      if (!text) {
        console.warn('Skipping row with missing text');
        errorCount++;
        continue;
      }

      const filePath = path.join(KEYWORD_OUTPUT_DIR, `${text}.json`);
      fs.writeFileSync(filePath, JSON.stringify(row, null, 2), 'utf-8');
      successCount++;
    } catch (err) {
      console.error(`Error writing file for text ${row.text}:`, err);
      errorCount++;
    }
  }

  db.close();

  console.log(`Keyword export completed:`);
  console.log(`  - Successfully exported: ${successCount}`);
  console.log(`  - Errors: ${errorCount}`);
  console.log(`  - Output directory: ${KEYWORD_OUTPUT_DIR}`);
}

// exportVideoInfoToJson();
// exportDownloadFileToJson();
// exportVideoPageToJson();
// exportKeywordToJson();
// export { DB_PATH, OUTPUT_DIR };
