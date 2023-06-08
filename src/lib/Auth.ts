import Retter, { RetterRegion } from '@retter/sdk'
import { RIO_CLI_PLATFORM, RIO_CLI_ROOT_DOMAIN, RIO_CLI_ROOT_PROJECT_ID, RIO_CLI_STAGE, RIO_CLI_URL, RIO_CLI_VERSION } from '../config'
import axios from 'axios'
import { IRIOCliConfigProfileItemData } from './CliConfig'
import jwt from 'jsonwebtoken'
import { Api } from './Api'
import chalk from 'chalk'

export enum RetterRootClasses {
  Project = 'Project',
  User = 'User',
  RetterClass = 'RetterClass',
}

export enum RetterRootMethods {
  generateAdminCustomToken = 'generateCustomTokenForRioCLI',
  getClassFiles = 'getFiles',
  upsertModel = 'upsertModel',
  upsertModels = 'upsertModels',
  createClass = 'createClass',
  saveClassFiles = 'save',
  deployClass = 'deploy',
  upsertDependency = 'upsertDependency',
}

export interface KeyValue {
  [key: string]: any
}
export interface AuthenticateCurrentSessionResponse {
  retter: Retter
  core_version?: string
}
async function getRootAdminCustomToken(config: IRIOCliConfigProfileItemData) {
  const token = jwt.sign(
    {
      projectId: RIO_CLI_ROOT_PROJECT_ID,
      secretId: config.secretId,
      expiresIn: 30,
    },
    config.secretKey,
  )

  const byKeyValue = {
    key: 'secretId',
    value: config.secretId,
  }

  const endpoint = config.endpoint || RIO_CLI_URL

  if (!endpoint) {
    throw new Error('There is no endpoint provided!, please check your rio profile')
  }

  const url = `https://${endpoint}/root/CALL/${RetterRootClasses.User}/${RetterRootMethods.generateAdminCustomToken}/${byKeyValue.key}!${byKeyValue.value}`

  const result = await axios.post(url, { idToken: token }, { headers: { 'x-cli-version': RIO_CLI_VERSION } })

  if (!result || !result.data || !result.data.customToken) {
    throw new Error('Custom token error!')
  }

  return {
    customToken: result.data.customToken,
    core_version: result.headers['x-rio-version'] || result.data.version, // TODO delete result.data.version after 6 months
  }
}

export async function authenticateCurrentSession(profile_config: IRIOCliConfigProfileItemData): Promise<AuthenticateCurrentSessionResponse> {
  try {
    const sdk = Retter.getInstance({
      projectId: RIO_CLI_ROOT_PROJECT_ID,
      url: profile_config.endpoint || RIO_CLI_URL,
      region: RIO_CLI_STAGE === 'PROD' ? RetterRegion.euWest1 : RetterRegion.euWest1Beta,
      platform: RIO_CLI_PLATFORM,
      logLevel: 'silent',
    })

    const customAuth = await getRootAdminCustomToken(profile_config)
    await sdk.authenticateWithCustomToken(customAuth.customToken)

    return { retter: sdk, core_version: customAuth.core_version }
  } catch (error: any) {
    Api.handleError(error, chalk.redBright(`There has been a problem with your credentials ❌`))
    throw error
  }
}
