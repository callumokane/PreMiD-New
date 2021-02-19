import { Ticket } from "../classes/ticket";

module.exports = {
    name: "message",
    run: async (client, msg) => {
        if(msg.author.bot) return;
        if(msg.channel.id == client.config.channels.supportChannel) {
            msg.delete();
            if(msg.content.length < 20) return (await msg.reply("please specify atleast 20 characters when creating a ticket.")).delete({timeout: 10000});
            if(msg.content.toLowerCase().includes("discord.gg")) return (await msg.reply("invite links are not allowed in tickets!")).delete({timeout: 10000});

            // Autodetected phrases to help clear tickets
            if(msg.content.toLowerCase().includes("chromebook")) return msg.author.send("We noticed you mentioned the phrase \`chromebook\` in your ticket. We do not currently support chromebooks! Your ticket has been automatically closed.");

            let ticket = new Ticket();
            ticket.create(msg, false);
        }
    }
}