import chalk from "chalk";


export class CustomError {
    static throwError(message: string) {
        console.error(chalk.bold.redBright(message))
        process.exit(1)
    }
}
