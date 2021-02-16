import { Client, Message } from "discord.js";

module.exports = {
    name: "message",
    type: "client",
    run: (client, msg) => {
        if(msg.channel.type == "dm") return;
        let prefixes = ["p!", "p1", "/"];
        prefixes.forEach(async inp => {
            let prefix = msg.content.match(new RegExp(`^<@!?${client.user.id}> `))
                ? msg.content.match(new RegExp(`^<@!?${client.user.id}> `))[0]
                : msg.content.toLowerCase().startsWith(inp.toLowerCase()) 
                ? inp : null;

            if(!prefix) return;

            let args = msg.content.replace(prefix, "").split(" ").slice(1),
                input = msg.content.replace(prefix, "").split(" ")[0].toLowerCase(),
                cmd = client.commands.get(input) || client.aliases.get(input);
            
            try {
                await cmd.run(client as Client, msg as Message, args as string[]);
            } catch(e) {
                msg.reply("an error occured while executing that command! Our development team have been notified.");
                client.channels.cache.get(client.config.channels.errors).send({embed: {
                    description: `${msg.author} | ${cmd.config.name}\n\n${e}`
                }})
            }
        })
    }
}