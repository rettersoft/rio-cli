import path from 'path';
import os from 'os';

export const RIO_CLI_ROOT_PROJECT_ID = 'root'
export const RIO_CLI_ROOT_DOMAIN = 'rtbs.io'
export const RIO_CLI_STAGE = (process.env.RIO_CLI_STAGE && process.env.RIO_CLI_STAGE === 'TEST') ? 'TEST' : 'PROD'
export const RIO_CLI_CONFIG_PATH = path.join(os.homedir(), '.rio-cli')
export const RIO_CLI_CONFIG_FILE_NAME = 'rio'
export const RIO_CLI_TEMP_FOLDER = '.tmp'
export const RIO_CLI_COS_TEMPLATES_REPO_NAME = 'rio-cos-templates'
export const RIO_CLI_PLATFORM = 'RIO'
export const RIO_CLI_DEFAULT_ADMIN_PROFILE_NAME = 'DEFAULT'

export const PROJECT_RIO_CLASS_FILE = 'rio.ts'
export const PROJECT_CLASSES_FOLDER = 'classes'
export const PROJECT_MODELS_FOLDER = 'models'
export const PROJECT_CLASS_TEMPLATE_FILE = 'template.yml'
export const PROJECT_RIO_CONFIG = 'rio.json'
