#!/usr/bin/env node
'use strict';
import yargs from "yargs"
import {RIO_CLI_DEFAULT_ADMIN_PROFILE_NAME} from "./config";
import path from "path";
import {hideBin} from 'yargs/helpers'


(async () => {
    await yargs(hideBin(process.argv))
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
        .demandCommand()
        .showHelpOnFail(true)
        .strict()
        .completion()
        .parse()
})().then().catch();
