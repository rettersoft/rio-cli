import {IDeploymentOperationItem, IFileChangesByClassName} from "./Deployment";
import chalk from "chalk";
import {IPreDeploymentContext} from "./ProjectManager";
import {createStream, getBorderCharacters, table, WritableStream} from "table"
import {TableUserConfig} from "table/dist/src/types/api";
import { Transform } from "stream";
import { Console } from "console";

export enum DeploymentMessageStatus {
    STARTED = "STARTED",
    FAILED = "FAILED",
    SUCCEED = "SUCCEED",
    SAVING = "SAVING",
    SAVED = "SAVED",
    DEPLOYING = "DEPLOYING",
    DEPLOYED = "DEPLOYED",
}

export class ConsoleMessage {
  static deploymentCurrentTableStream: WritableStream

  static errorMessage(message: string) {
    console.error(chalk.redBright(message))
  }

  static message(message: string) {
    console.log('\n' + message)
  }

  static table(data: unknown[][], title?: string) {
    const tableConfig: TableUserConfig = {
      columnDefault: {},
      header: title
        ? {
            alignment: 'left',
            content: chalk.blueBright(title),
          }
        : undefined,
      border: getBorderCharacters('norc'),
    }
    console.log(table(data, tableConfig))
  }

  static customDeploymentMessage(message: string) {
    ConsoleMessage.deploymentCurrentTableStream.write(['', '', '', '', chalk.bold.gray(message)])
  }

  static deploymentMessage(item: IDeploymentOperationItem, status: DeploymentMessageStatus) {
    if (!ConsoleMessage.deploymentCurrentTableStream) {
      ConsoleMessage.deploymentCurrentTableStream = createStream({
        columnDefault: {
          width: 8,
        },
        columnCount: 5,
        columns: [
          {
            width: 22,
            alignment: 'left',
          },
          { alignment: 'left', width: 10 },
          { alignment: 'left', width: 10 },
          { alignment: 'left' },
          { alignment: 'left', width: 30 },
        ],
        border: getBorderCharacters('norc'),
      })
    }

    let statusStyle
    switch (status) {
      case DeploymentMessageStatus.FAILED:
        statusStyle = chalk.bold.redBright
        break
      case DeploymentMessageStatus.STARTED:
      case DeploymentMessageStatus.SAVED:
      case DeploymentMessageStatus.SAVING:
      case DeploymentMessageStatus.DEPLOYING:
      case DeploymentMessageStatus.DEPLOYED:
      case DeploymentMessageStatus.SUCCEED:
        statusStyle = chalk.bold.greenBright
        break
      default:
        statusStyle = chalk.bold.gray
        break
    }
    ConsoleMessage.deploymentCurrentTableStream.write([chalk.gray(new Date().toLocaleString()), statusStyle(status), chalk.green(item.type), chalk.bold.gray(item.status), chalk.bold.gray(item.path)])
  }

  static fancyTable(input: any, title: string) {
    console.log(chalk`{rgb(200,200,200) ${title}}`);
    // @see https://stackoverflow.com/a/67859384
    const ts = new Transform({
      transform(chunk, enc, cb) {
        cb(null, chunk)
      },
    })
    const logger = new Console({ stdout: ts })
    logger.table(input)
    const table = (ts.read() || '').toString()
    let result = ''
    for (let row of table.split(/[\r\n]+/)) {
      let r = row.replace(/[^┬]*┬/, '┌')
      r = r.replace(/^├─*┼/, '├')
      r = r.replace(/│[^│]*/, '')
      r = r.replace(/^└─*┴/, '└')
      r = r.replace(/'/g, ' ')
      result += chalk`{rgb(200,200,200) ${r}}\n`
    }
    console.log(result)
  }
}
