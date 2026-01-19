import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const COMMAND = 'bun';
const ARGS = ['c:\\Users\\lithd\\Documents\\GitHub\\home-lab\\projects\\maxjavr\\fetch_html.ts'];
const MAX_EXECUTION_TIME = 60 * 60 * 1000; // 1小时
const INTERVAL_TIME = 30 * 60 * 1000; // 30分钟
const OUTPUT_DIR = path.join(__dirname, 'output');

// 执行计数器和计时器
let executionCount = 0;
let startTime: number | null = null;
let statusInterval: NodeJS.Timeout | null = null;

// 确保输出目录存在
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// 日志函数
function log(message: string) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

// 获取命令输出文件路径
function getOutputFilePath() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
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
    log(`命令执行超时 (超过1小时)，正在终止...`);
    child.kill();
  }, MAX_EXECUTION_TIME);
  
  child.on('exit', (code, signal) => {
    clearTimeout(timeoutId);
    if (statusInterval) {
      clearInterval(statusInterval);
      statusInterval = null;
    }
    process.stderr.write('\r'.padEnd(80, ' ') + '\r');
    
    if (signal === 'SIGTERM') {
      log(`命令被超时终止`);
    } else if (code === 0) {
      log(`命令执行成功`);
    } else {
      log(`命令执行失败，退出码: ${code}`);
    }
    
    // 等待指定间隔后再次执行
    log(`等待 ${INTERVAL_TIME / 1000 / 60} 分钟后再次执行...`);
    setTimeout(executeCommand, INTERVAL_TIME);
  });
  
  child.on('error', (error) => {
    clearTimeout(timeoutId);
    if (statusInterval) {
      clearInterval(statusInterval);
      statusInterval = null;
    }
    process.stderr.write('\r'.padEnd(80, ' ') + '\r');
    
    log(`命令执行出错: ${error.message}`);
    
    // 等待指定间隔后再次执行
    log(`等待 ${INTERVAL_TIME / 1000 / 60} 分钟后再次执行...`);
    setTimeout(executeCommand, INTERVAL_TIME);
  });
}

// 启动执行循环
log(`启动命令执行循环`);
executeCommand();