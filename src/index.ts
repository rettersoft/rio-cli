#!/usr/bin/env node
'use strict';
import yargs from "yargs"
import {RIO_CLI_DEFAULT_ADMIN_PROFILE_NAME} from "./config";
import path from "path";


yargs
    .usage(`RIO CLI
    Usage: rio <command>
    `)
    .options({
        "profile": {
            default: RIO_CLI_DEFAULT_ADMIN_PROFILE_NAME,
            describe: 'Admin profile to execute command'
        }
    })
    .commandDir(path.join(__dirname, 'commands'), {exclude: /ICommand\.(ts|js)|AfterCommand\.(ts|js)/g})
    .parse()

yargs.argv;
