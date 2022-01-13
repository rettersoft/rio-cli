export abstract class Base {
    readonly profile: string;

    protected constructor(profile = 'default') {
        this.profile = profile
    }

}