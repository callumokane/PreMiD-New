import chalk from "chalk";

export const createLogger = () => new class Logger {
	info = (message: String) => console.log(`${chalk.bgBlue("  ")} ${message}`);
	debug = (message: String) => console.log(`${chalk.bgRedBright("  ")} ${message}`);
	error = (message: String)  => console.log(`${chalk.bgRed("  ")} ${message}`);
	success = (message: String) => console.log(`${chalk.bgGreen("  ")} ${message}`);
}