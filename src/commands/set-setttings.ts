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
  command: 'set-settings',
  description: `
  Description: Synchronize your local project configuration with the remote project, enabling you to effortlessly create or update log adapters, state stream targets, and more.
    Arguments:
    --profile [p]: Profile name for target rio environment (type: string)
    --project-id [pid]: Project id for target project (type: string)

    Usage: 
    rio set-settings --profile <profile_name> --project-id <project_id>
    rio ss --p <profile_name> --pid <project_id>
  `,
  aliases: ['ss'],
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
      throw new Error(`To run this command you need to provide a projectId. Please provide it in ${PROJECT_RIO_CONFIG} or with --project-id, --pid flag`)
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
    // PARSE LOCAL DATA
    // ***********************

    const jsonPath = path.join(process.cwd(), PROJECT_RIO_CONFIG)
    try {
      await fs.promises.access(jsonPath, fs.constants.R_OK)
    } catch (err: any) {
      throw new Error(`We couldnt find any configuration (${PROJECT_RIO_CONFIG}) file in your project. You need that to run this command.`)
    }

    let jsonContent: any
    try {
      const projectRioConfigContent = fs.readFileSync(jsonPath)
      jsonContent = JSON.parse(projectRioConfigContent.toString('utf-8'))
    } catch (err: any) {
      throw new Error(`Your configuration file is not a valid json file. Please give it a look.`)
    }

    const settings = V2ProjectConfig.safeParse(jsonContent)

    if (settings.success === false) {
      console.log(settings.error.issues)
      throw new Error(`Your configuration (${PROJECT_RIO_CONFIG}) file is not a valid configuration file. Please check the issues above.`)
    }

    console.log(chalk.greenBright(`Configuration (${PROJECT_RIO_CONFIG}) file successfully read ✅ \n\n`))

    // ***********************
    // UPLOAD NEW DATA TO ROOT
    // ***********************

    console.log(chalk.yellow(`API connecting...`))
    const api = await Api.createAPI(profile_config, projectId)
    console.log(chalk.greenBright(`API CONNECTED ✅ ${api.v2 ? chalk.gray('v2') : ''}\n\n`))

    if (!api.v2) {
      throw new Error(`This command is only available for v2 projects.`)
    }
    
    const projectState = (await api.getProjectState()) as ProjectState

    const mappedStateStreamTargets = settings.data.stateStreamTargets?.map((target: any) => {
      const existed = projectState.public.projectConfig.stateStreamTargets.find((t) => t.id === target.id)

      if (!existed) return target

      return {
        ...target,
        mappingId: existed.mappingId,
      }
    })

    const mappedLogAdaptors = settings.data.loggingAdapters?.map((target: any) => {
      const existed = projectState.public.projectConfig.loggingAdapters.find((t) => t.id === target.id)

      if (!existed) return target

      return {
        ...target,
        mappingId: existed.mappingId,
      }
    })

    console.log(chalk.yellow(`Updating project settings please wait...\n\n`))

    if ((!mappedLogAdaptors || mappedLogAdaptors.length === 0) && (!mappedStateStreamTargets || mappedStateStreamTargets.length === 0)) {
      console.log(chalk.yellow(`No settings to update. \n\n`))
      afterCommand()
      return
    }

    if (mappedLogAdaptors && mappedLogAdaptors.length > 0) {
      await api.setLogginAdaptors({ loggingAdapters: mappedLogAdaptors })
      console.log(`${'[Log Adapters]'.padEnd(25," ")} ${chalk.greenBright('UPDATED ✅')}`)
    }

    if (mappedStateStreamTargets && mappedStateStreamTargets.length > 0) {
      await api.setStateStreamTargets({ targets: mappedStateStreamTargets })
      console.log(`${'[State Stream Targets]'.padEnd(25," ")} ${chalk.greenBright('UPDATED ✅')}`)
    }

    console.log(chalk.greenBright(`\n\nProject settings successfully updated ✅ \n\n`))

    afterCommand()
  },
} as CommandModule<Input, Input>
