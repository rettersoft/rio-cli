import afterCommand from './AfterCommand'
import { CommandModule } from 'yargs'
import { PROJECT_RIO_CONFIG, RIO_CLI_PROJECT_ID_KEY, RIO_CLI_URL } from '../config'
import { Input, saveAndDeploy } from '../lib/save-and-deploy'
import { CliConfig } from '../lib/CliConfig'
import { getProjectConfig } from '../lib/v2/utils'
import { ConsoleMessage } from '../lib/v1/ConsoleMessage'
import chalk from 'chalk'
import { Api } from '../lib/Api'
import path from 'path'
import fs from 'fs'
import { ProjectState, V2ProjectConfig } from '../lib/v2/types'

module.exports = {
  command: 'get-settings',
  description: `
  Description: Fetches project data and generates a project configuration file on your local disk
    Arguments:
    --profile [p]: Profile name for target rio environment (type: string)
    --project-id [pid]: Project id for target project (type: string)
    Usage: 
    rio get-settings --profile <profile_name> --project-id <project_id>
    rio gs --p <profile_name> --pid <project_id>
  `,
  aliases: ['gs'],
  builder: (yargs) => {
    yargs.options('profile', {
      alias: 'p',
      describe: ' Profile name for target rio environment (type: string)',
      type: 'string',
    })
    yargs.options('project-id', {
      alias: 'pid',
      describe: 'Project id for target project (type: string)',
      type: 'string',
    })
    return yargs
  },
  handler: async (args) => {

    // ***********************
    // PRINT COMMAND CONFIGIURATION
    // ***********************

    const profile_config = CliConfig.getAdminConfig(args.profile)
    const config = await getProjectConfig()
    const projectId = args['project-id'] || config.projectId

    if (!projectId) {
      throw new Error(`To run this command we need a projectId. Please provide it in ${PROJECT_RIO_CONFIG} or with --project-id flag`)
    }

    const exampleArray = [
      {
        Profile: args.profile,
        ProjectId: projectId,
        Endpoint: profile_config.endpoint || RIO_CLI_URL,
      },
    ]

    ConsoleMessage.fancyTable(exampleArray, 'Command Configuration:')

    // ***********************
    // GET REMOTE DATA
    // ***********************

    console.log(chalk.yellow(`API connecting...`))
    const api = await Api.createAPI(profile_config, projectId)
    console.log(chalk.greenBright(`API CONNECTED ✅ ${api.version ? chalk.gray(`v${api.version}`) : ''}\n\n`))

    if (!api.isV2) {
      throw new Error(`This command is only available for v2 & v projects`)
    }

    console.log(chalk.yellow(`Creating project configuration file, please wait...`))

    const [stateStreamTargets, loggingAdapters] = await Promise.all([api.getStateStreamTargets(), api.getLoggingAdapters()])

    const remote_config = {
      projectId,
      loggingAdapters: loggingAdapters,
      stateStreamTargets: stateStreamTargets,
    }

    const parsed_config = V2ProjectConfig.safeParse(remote_config)

    if (parsed_config.success === false) {
      console.log(parsed_config.error.issues)
      throw new Error(`Downloaded configuration (${PROJECT_RIO_CONFIG}) file is not a valid configuration file. Please check the issues above.`)
    }

    // ***********************
    // WRITE REMOTE DATA TO LOCAL FILE
    // ***********************

    const jsonPath = path.join(process.cwd(), PROJECT_RIO_CONFIG)

    fs.writeFileSync(jsonPath, JSON.stringify(parsed_config.data))

    console.log(chalk.greenBright(`Project configuration file created successfully ✅ at '${jsonPath}', Edit it carefully ! \n\n`))

    afterCommand()
  },
} as CommandModule<Input, Input>
