const chalkColors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function formatTime() {
  return new Date().toISOString();
}

const logger = {
  info: (msg, meta = '') => {
    console.log(`${chalkColors.dim}[${formatTime()}]${chalkColors.reset} ${chalkColors.blue}ℹ INFO${chalkColors.reset} ${msg}`, meta ? meta : '');
  },
  success: (msg, meta = '') => {
    console.log(`${chalkColors.dim}[${formatTime()}]${chalkColors.reset} ${chalkColors.green}✔ SUCCESS${chalkColors.reset} ${msg}`, meta ? meta : '');
  },
  warn: (msg, meta = '') => {
    console.warn(`${chalkColors.dim}[${formatTime()}]${chalkColors.reset} ${chalkColors.yellow}⚠ WARN${chalkColors.reset} ${msg}`, meta ? meta : '');
  },
  error: (msg, err = '') => {
    console.error(`${chalkColors.dim}[${formatTime()}]${chalkColors.reset} ${chalkColors.red}✖ ERROR${chalkColors.reset} ${msg}`, err ? err : '');
  },
  retry: (attempt, max, delay, reason) => {
    console.log(`${chalkColors.dim}[${formatTime()}]${chalkColors.reset} ${chalkColors.magenta}↺ RETRY [${attempt}/${max}]${chalkColors.reset} Waiting ${delay}ms: ${reason}`);
  },
  scraper: (type, status, details) => {
    const col = status === 'SUCCESS' ? chalkColors.green : status === 'FAILED' ? chalkColors.red : chalkColors.yellow;
    console.log(`${chalkColors.dim}[${formatTime()}]${chalkColors.reset} ${chalkColors.cyan}[SCRAPER:${type}]${chalkColors.reset} ${col}${status}${chalkColors.reset} - ${details}`);
  }
};

module.exports = logger;
