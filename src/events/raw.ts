import { GuildMember } from "discord.js";

module.exports = {
    name: "raw",
    run: async (client, out) => {
        if(out.t != "INTERACTION_CREATE") return;

        let cmd = client.command.find(c => c.config.name == out.d.data.name && c.config.slashCommand),
            perms = await client.elevation(out.d.member.user.id);

        if(!cmd) return;
        if (typeof cmd.config.permLevel != "undefined" && perms < cmd.config.permLevel) return out.d.channel.send<(`<@${out.d.member.user.id}>, you do not have the required permissions to run this command.`);
        
        let data = out.d;
        data["guild"] = client.guilds.resolve(data.guild_id);
        data["channel"] = client.guilds.resolve(data.guild_id);
        data["member"] = new GuildMember(client, data.member, data.guild);

        cmd.run(data, perms, client);
    }
}