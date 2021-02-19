import { Ticket } from "../classes/ticket";

module.exports = {
    name: "message",
    run: async (client, msg) => {
        if(msg.author.bot) return;
        if(msg.channel.id == client.config.channels.supportChannel) {
            if(msg.content.length < 20) {msg.delete();(await msg.reply("please specify atleast 20 characters when creating a ticket.")).delete({timeout: 10000});return;};
            if(msg.content.toLowerCase().includes("discord.gg")) {msg.delete();(await msg.reply("invite links are not allowed in tickets!")).delete({timeout: 10000});return;};

            // Autodetected phrases to help clear tickets
            if(msg.content.toLowerCase().includes("chromebook")) {msg.delete();msg.author.send("We noticed you mentioned the phrase \`chromebook\` in your ticket. We do not currently support chromebooks! Your ticket has been automatically closed.");return;};

            let attachments = [], caught = false, mAttachments = msg.attachments.map(x => x), ticket = new Ticket(), ticketCount = await client.db.collection("tickets").countDocuments({}), ticketId = (ticketCount++).toString().padStart(5, "0");
            
            try {
                (await msg.author.send("Creating ticket...")).delete()
            } catch {
                caught = true;
                (await msg.channel.send(`${msg.author}, please ensure you have DMs enabled to be able to create a ticket.`)).delete({timeout: 10000});
            };

            if(caught) return;

            client.db.collection("tickets").insertOne({ticketId: ticketId});

            ticket.id = ticketId;

            for await (const attachment of mAttachments) attachments.push(await ticket.attachImage(attachment));

            ticket.create(msg, false, attachments, ticketId);
            msg.delete();
        }
        let ticket = new Ticket();
        if (!(await ticket.fetch("channel", msg.channel.id))) return;

        ticket.addLog(`[MESSAGE] ${msg.author.tag}: ${msg.content}`);

        if(!ticket) return; 
        if(!ticket.supporters.includes(msg.author.id) && !msg.content.startsWith(">>") && ticket.userId != msg.author.id) return ticket.addSupporter(msg, [""], true);
        if(msg.content.startsWith(">>")) ticket.addSupporter(msg, msg.content.replace(">>", "").split(" "));
        if(msg.content.startsWith("<<")) ticket.removeSupporter(msg, msg.content.replace(">>", "").split(" "));
    }
}