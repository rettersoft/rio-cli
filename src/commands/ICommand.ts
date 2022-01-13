import {Arguments, BuilderCallback, MiddlewareFunction} from "yargs";

export interface GlobalInput{
    profile: string
}

export interface ICommand<T = any, U = any> {
    command: string | ReadonlyArray<string>,
    description: string,
    builder?: BuilderCallback<T, U>,
    handler?: (args: Arguments<U>) => void | Promise<void>,
    middlewares?: MiddlewareFunction[],
    deprecated?: boolean | string,
}
