import { spawn, ChildProcess, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const COMMAND = 'bun';
const ARGS = ['C:\\Users\\lithd\\Documents\\GitHub\\home-lab\\projects\\maxjavr\\data-store\\【fsdb-store】\\[FSDB]maxjavr\\fetch_html.ts'];
const MAX_EXECUTION_TIME = 60 * 60 * 1000 * 2; // 2小时
const INTERVAL_TIME = 30 * 60 * 1000; // 20分钟
const OUTPUT_DIR = path.join(__dirname, 'output');

// 执行计数器和计时器
let executionCount = 0;
let startTime: number | null = null;
let statusInterval: NodeJS.Timeout | null = null;
let waitStartTime: number | null = null;
let waitStatusInterval: NodeJS.Timeout | null = null;

// 停止状态更新定时器
function clearStatusInterval() {
  if (statusInterval) {
    clearInterval(statusInterval);
    statusInterval = null;
  }
  if (waitStatusInterval) {
    clearInterval(waitStatusInterval);
    waitStatusInterval = null;
  }
  process.stderr.write('\r'.padEnd(80, ' ') + '\r');
}

// 确保输出目录存在
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// 日志函数
function log(message: string) {
  const now = new Date();
  const timestamp = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
  console.log(`[${timestamp}] ${message}`);
}

// 获取命令输出文件路径
function getOutputFilePath() {
  const now = new Date();
  const timestamp = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
  return path.join(OUTPUT_DIR, `execution-${executionCount}-${timestamp}.log`);
}

// 清行输出状态
function updateStatus() {
  if (startTime) {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = elapsed % 60;
    const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    process.stderr.write(`\r执行次数: ${executionCount}, 已耗时: ${timeStr}\x1b[K`);
  }
}

// 格式化耗时
function formatElapsedTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// 显示等待状态
function updateWaitStatus() {
  if (waitStartTime) {
    const elapsed = Math.floor((Date.now() - waitStartTime) / 1000);
    const elapsedStr = formatElapsedTime(elapsed);
    const remaining = INTERVAL_TIME / 1000 - elapsed;
    
    if (remaining > 0) {
      const remainingMin = Math.floor(remaining / 60);
      const remainingSec = Math.floor(remaining % 60);
      process.stderr.write(`\r等待中: ${elapsedStr} / ${remainingMin.toString().padStart(2, '0')}:${remainingSec.toString().padStart(2, '0')}\x1b[K`);
    } else {
      process.stderr.write(`\r等待中: ${elapsedStr}\x1b[K`);
    }
  }
}

function executeCommand() {
  executionCount++;
  startTime = Date.now();
  
  const outputFilePath = getOutputFilePath();
  log(`开始执行命令 (第 ${executionCount} 次): ${COMMAND} ${ARGS.join(' ')}`);
  log(`命令输出将保存到: ${outputFilePath}`);
  
  // 启动状态更新定时器
  statusInterval = setInterval(updateStatus, 1000);
  
  const child = spawn(COMMAND, ARGS, {
    stdio: 'pipe',
    shell: true
  });
  
  let timeoutId: NodeJS.Timeout;
  
  // 捕获标准输出
  child.stdout?.on('data', (data) => {
    fs.appendFileSync(outputFilePath, data.toString());
  });
  
  // 捕获标准错误
  child.stderr?.on('data', (data) => {
    fs.appendFileSync(outputFilePath, data.toString());
  });
  
  // 设置最大执行时间
  timeoutId = setTimeout(() => {
    // 计算耗时
    const elapsed = Date.now() - (startTime || Date.now());
    const elapsedStr = formatElapsedTime(elapsed);
    
    log(`命令执行超时 (超过2小时)，正在终止...`);
    log(`本次耗时: ${elapsedStr}`);
    
    // 先停止状态更新定时器
    if (statusInterval) {
      clearInterval(statusInterval);
      statusInterval = null;
    }
    process.stderr.write('\r'.padEnd(80, ' ') + '\r');
    
    // 在 Windows 上使用 taskkill 强制终止进程及其子进程
    try {
      execSync(`taskkill /F /T /PID ${child.pid}`, { encoding: 'utf8' });
    } catch (e) {
      // 进程可能已经退出，忽略错误
    }
  }, MAX_EXECUTION_TIME);
  
  child.on('exit', (code, signal) => {
    clearTimeout(timeoutId);
    clearStatusInterval();
    
    if (signal === 'SIGTERM') {
      log(`命令被超时终止`);
    } else if (code === 0) {
      log(`命令执行成功`);
    } else {
      log(`命令执行失败，退出码: ${code}`);
    }
    
    // 等待指定间隔后再次执行
    log(`等待 ${INTERVAL_TIME / 1000 / 60} 分钟后再次执行...`);
    
    // 启动等待状态更新
    waitStartTime = Date.now();
    waitStatusInterval = setInterval(updateWaitStatus, 1000);
    setTimeout(executeCommand, INTERVAL_TIME);
  });
  
  child.on('error', (error) => {
    clearTimeout(timeoutId);
    clearStatusInterval();
    
    log(`命令执行出错: ${error.message}`);
    
    // 等待指定间隔后再次执行
    log(`等待 ${INTERVAL_TIME / 1000 / 60} 分钟后再次执行...`);
    
    // 启动等待状态更新
    waitStartTime = Date.now();
    waitStatusInterval = setInterval(updateWaitStatus, 1000);
    setTimeout(executeCommand, INTERVAL_TIME);
  });
}

// 启动执行循环
log(`启动命令执行循环`);
executeCommand();