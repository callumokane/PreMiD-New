import moment from "moment";

import { GuildMember, Message, TextChannel } from "discord.js";
import {client, db} from "../../../";

let coll = db.collection("tickets");

export class Ticket {
    id: string;
    user: GuildMember;
    channel: TextChannel;
    supporters: GuildMember[];

    async fetch(filter: "ticket" | "author" | "id" | "channel" | "message", input: string | Message | TextChannel) {
        let ticket: any;

        filter == "ticket" ? input
            : filter == "channel" ? ticket = await coll.findOne({ supportChannel: input })
            : filter == "message" ? ticket = await coll.findOne({ ticektMessage: input })
            : filter == "author" ? ticket = await coll.findOne({ userId: input })
            : filter == "id" ? ticket = await coll.findOne({ userId: input })
            : ticket = null;

        if(!ticket) return;

        for (const key of Object.keys(ticket)) this[key] = ticket[key];

        this.id = ticket.ticketId;
    }

    async create(message: Message) {
        let ticketCount = await coll.countDocuments({}),
            ticketId = (ticketCount++).toString().padStart(5, "0"),
            attachments = [];

            for(const attachment in message.attachments) {
                client.fetch("some image uploader api we make ok yes sexy", {
                    headers: {}, 
                    body: {}
                })
            }

            //wip
    }

    delete() {}
    accept() {}
    reject() {}
    close() {}
    addSupporter() {}
    removeSupporter() {}
    attachImage() {}

    addLog(input: string) {
        coll.findOneAndUpdate({id: this.id}, {$push: {logs: `[${moment(new Date()).format("DD/MM/YY LT")} (${Date().split("(")[1].replace(")", "").match(/[A-Z]/g).join("")})] ${input}`}})
    }
    
    closeWarning() {
        this.addLog("Sent close warning (2 days to respond)");
        this.channel.send(`${this.user.toString()}, ${this.supporters.map(s => s.toString()).join(", ")} You have 2 days to respond to this ticket before it is automatically closed. To keep the ticket open, simply send a message!`);
        coll.findOneAndUpdate({id: this.id}, {$set: {ticketCloseWarning: Date.now()}});
    }
}

//statuses
//1 - pending confirmation
//2 - pending supporter
//3 - chat open, ticket in progress
//4 - ticket closed