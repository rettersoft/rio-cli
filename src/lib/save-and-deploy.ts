import chalk from 'chalk'
import { ConsoleMessage } from '../lib/v1/ConsoleMessage'
import prompts from 'prompts'
import { ProjectManager } from '../lib/v1/ProjectManager'
import { Project } from '../lib/v1/Project'
import { Deployment } from '../lib/v1/Deployment'
import { RIO_CLI_URL, RIO_CLI_VERSION } from '../config'
import { Api } from '../lib/Api'
import { CliConfig } from '../lib/CliConfig'
import { deployV2 } from '../lib/v2/deploy'
import { analyze, isChanged, printSummaryV2 } from '../lib/v2/analyze'
import { getProjectConfig } from './v2/utils'

export interface Input {
  profile: string
  force: boolean
  classes?: string[]
  'project-id': string
  'ignore-approval': boolean
  'skip-diff-check': boolean
  'save-only': boolean
}

function addAsterisks(string: string): string {
  const totalLength = 60
  const line = '*'.repeat(string.length)
  const remainingLength = totalLength - string.length
  const spaces = ' '.repeat(remainingLength / 2)
  return `${spaces}${line}${spaces}\n${spaces}${string}${spaces}\n${spaces}${line}${spaces}`
}

const processV1 = async (api: Api, args: Input) => {
  const start = Date.now()
  console.log(chalk.yellow(`PRE-DEPLOYMENT started...`))
  const deploymentSummary = await ProjectManager.preDeploymentV1(api, args.classes)

  const pre_finish = (Date.now() - start) / 1000
  console.log(chalk.greenBright(`PRE-DEPLOYMENT FINISHED ✅ ${pre_finish} seconds`))

  if (!args['skip-diff-check'] && !Deployment.isChanged(deploymentSummary)) {
    ConsoleMessage.message(chalk.bold.red('No Changes') + chalk.bold.grey(" -> if you want to ignore diff check use '--skip-diff-check, --s' flag"))
    process.exit()
  }

  /**
   * MANUAL-APPROVAL
   */
  if (!args['ignore-approval']) {
    const response = await prompts({
      type: 'confirm',
      name: 'value',
      message: `Are you sure to proceed?`,
      initial: true,
    })
    if (!response.value) {
      ConsoleMessage.message('Deployment cancelled!')
      process.exit()
    }
  }

  const deploy = !args['save-only']
  const msg = deploy ? 'DEPLOYMENT': 'SAVING'
  ConsoleMessage.message(`${chalk.green(`${msg} STARTED`)}`)
  await Deployment.deploy(api, deploymentSummary, args['skip-diff-check'], args.force, deploy)
  const finish = (Date.now() - start) / 1000
  ConsoleMessage.message(chalk.greenBright(`${msg} Finished ✅ ${finish} seconds`))
}

const processV2 = async (api: Api, args: Input) => {
  const skipDiff = args['skip-diff-check']
  const force = args.force
  const deploy = !args['save-only']

  const start = Date.now()
  console.log(chalk.yellow(addAsterisks(`Gathering information`) + '\n'))

  const analyzationResult = await analyze({
    api,
    skipDiff,
    classes: args.classes,
  })

  const pre_finish = ((Date.now() - start) / 1000).toFixed(1)
  await printSummaryV2(analyzationResult.comparization)
  console.log(chalk.greenBright(addAsterisks(`Gathered information ✅ ${pre_finish} seconds`)))

  if (!isChanged(analyzationResult.comparization)) {
    console.log(chalk.bold.redBright('\nNo Changes detected in this project since last deploy it was') + chalk.bold.grey(" -> if you want to ignore diff check use '--skip-diff-check, --s' flag\n"))
    process.exit()
  }

  if (!args['ignore-approval']) {
    console.log('\n')
    const response = await prompts({
      type: 'confirm',
      name: 'value',
      message: `Are you sure to proceed?`,
      initial: true,
    })
    if (!response.value) {
      console.log(chalk.redBright(`Changes are not approved, project deployment canceled ❌`))
      process.exit()
    }
    console.log('\n')
  }

  const msg = deploy ? 'Starting Deployment': 'Started Saving'
  const msg2 = deploy ? 'Deployed': 'Saved'

  console.log(chalk.yellow(addAsterisks(msg) + '\n\n'))

  await deployV2({
    api,
    analyzationResult,
    force,
    deploy,
  })

  const finish = ((Date.now() - start) / 1000).toFixed(1)

  console.log(chalk.greenBright(addAsterisks(`${msg2} ✅ ${finish} seconds `)))
}

export const saveAndDeploy = async (args: Input) => {
  const profile_config = CliConfig.getAdminConfig(args.profile)
  const config = await getProjectConfig()
  const projectId = args['project-id'] || config.projectId

  if (!projectId) {
    console.log(chalk.redBright(`Project ID is not provided!`))
    process.exit()
  }

  const exampleArray = [
    {
      "CLI Version": RIO_CLI_VERSION,
      Profile: args.profile,
      Classes: args.classes?.toString() || 'All Classes',
      ProjectId: projectId,
      Endpoint: profile_config.endpoint || RIO_CLI_URL,
      'Skip Diff Check': args['skip-diff-check'] ? 'Yes' : 'No',
      Force: args.force ? 'Yes' : 'No',
      Deploy: args['save-only'] ? 'No' : 'Yes',
    },
  ]

  ConsoleMessage.fancyTable(exampleArray, 'Command Configuration:')

  console.log(chalk.yellow(`API connecting...`))
  const api = await Api.createAPI(profile_config, projectId)
  console.log(chalk.greenBright(`API CONNECTED ✅ ${api.isV2 ? chalk.gray(`v${api.version}`) : ''}\n\n`))

  if (api.isV2) {
    await processV2(api, args)
  } else {
    await processV1(api, args)
  }
}
