import {readdirSync, existsSync} from "fs";

const modules = readdirSync(`${process.cwd()}/dist/modules/`, {withFileTypes: true}).filter(dirent => dirent.isDirectory()).map(x => `${process.cwd()}/dist/modules/${x.name}`);

export const loadEvents = async (client) => {
    modules.forEach(async module => {
        let eventsPath = `${process.cwd()}/dist/modules/${module}/events/`;
        if(existsSync(eventsPath)) 
            (await readdirSync(eventsPath)).filter(x => x.endsWith(".js"))
                .forEach(file => {
                    let event = require(`${eventsPath}${file}`);
                    client.on(event.name, (...args) => event.run(client, ...args));
                })
    })
    
    return true;
}

export const loadCommands = async (client) => {
    modules.forEach(async module => {
        let commandsPath = `${process.cwd()}/dist/modules/${module}/commands/`;
        if(existsSync(commandsPath)) 
            (await readdirSync(commandsPath)).filter(x => x.endsWith(".js"))
                .forEach(file => {
                    let command = require(`${commandsPath}${file}`);
                    client.commands.set(command.name, command);
                    command.aliases.forEach(alias => client.aliases.set(alias, command));
                })
    })
    
    return true;
}