import path from 'path';
import os from 'os';

export const RIO_CLI_VERSION = '1.23.0'
export const RIO_CLI_ROOT_PROJECT_ID = 'root'
export const RIO_CLI_ROOT_DOMAIN = 'retter.io'
export const RIO_CLI_URL = process.env.RIO_CLI_URL
export const RIO_CLI_STAGE = (process.env.RIO_CLI_STAGE && process.env.RIO_CLI_STAGE === 'TEST') ? 'TEST' : 'PROD'
export const RIO_CLI_CONFIG_PATH = path.join(os.homedir(), '.rio-cli')
export const RIO_CLI_CONFIG_FILE_NAME = 'rio'
export const RIO_CLI_TEMP_FOLDER = '.tmp'
export const RIO_CLI_COS_TEMPLATES_REPO_NAME = 'rio-cos-templates'
export const RIO_CLI_PLATFORM = 'RIO'
export const RIO_CLI_DEFAULT_ADMIN_PROFILE_NAME = 'DEFAULT'
export const RIO_CLI_IGNORE_FILE = '.rioignore'
export const RIO_CLI_PROJECT_ID_KEY = 'RIO_CLI_PROJECT_ID'
export const RIO_CLI_DEPENDENCIES_FOLDER = 'dependencies'

export const RIO_CLI_SECRET_ID = process.env.RIO_CLI_SECRET_ID
export const RIO_CLI_SECRET_KEY = process.env.RIO_CLI_SECRET_KEY

export const PROJECT_RIO_CLASS_FILE = 'rio.ts'
export const PROJECT_CLASSES_FOLDER = 'classes'
export const PROJECT_MODELS_FOLDER = 'models'
export const PROJECT_MODEL_FILE_EXTENSION = '.json'
export const PROJECT_CLASS_TEMPLATE_FILE = 'template.yml'
export const PROJECT_RIO_CONFIG = 'rio.json'
export const PROJECT_GENERATED_DOCS_FOLDER = '.docs'
export const PROJECT_README_FILE = 'readme.md'
export const PROJECT_DOCUMENTATION_NAME = 'Documentation'
export const PROJECT_PACKAGE_JSON_FILE = 'package.json'
