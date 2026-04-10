import chalk from 'chalk';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'success';

let currentLogLevel: LogLevel = 'info';

const LOG_ORDER: LogLevel[] = ['debug', 'info', 'warn', 'error', 'success'];

export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level;
}

function shouldLog(level: LogLevel): boolean {
  if (level === 'success') return true;
  if (level === 'debug' && currentLogLevel !== 'debug') return false;
  return LOG_ORDER.indexOf(level) >= LOG_ORDER.indexOf(currentLogLevel);
}

export const logger = {
  debug(message: string, ...args: unknown[]): void {
    if (shouldLog('debug')) {
      console.log(chalk.gray(`[debug] ${message}`), ...args);
    }
  },

  info(message: string, ...args: unknown[]): void {
    if (shouldLog('info')) {
      console.log(chalk.cyan(`[info] ${message}`), ...args);
    }
  },

  warn(message: string, ...args: unknown[]): void {
    if (shouldLog('warn')) {
      console.warn(chalk.yellow(`[warn] ${message}`), ...args);
    }
  },

  error(message: string, ...args: unknown[]): void {
    if (shouldLog('error')) {
      console.error(chalk.red(`[error] ${message}`), ...args);
    }
  },

  success(message: string, ...args: unknown[]): void {
    if (shouldLog('success')) {
      console.log(chalk.green(`  ${message}`), ...args);
    }
  },

  plain(message: string, ...args: unknown[]): void {
    console.log(message, ...args);
  },

  heading(message: string): void {
    console.log('\n' + chalk.bold.blue(`  ${message}`));
  },

  subheading(message: string): void {
    console.log(chalk.bold.white(`  ${message}`));
  },
};
