import moment from "moment";
import axios from "axios";
import path from "path";
import FormData from "form-data";
import rimraf from "rimraf";

import { CategoryChannel, GuildMember, Message, OverwriteResolvable, TextChannel, WebhookClient } from "discord.js";
import { createWriteStream, writeFileSync } from "fs";
import { writeFile } from "fs/promises";
import { client } from "../../../";
import { getVars, sortTickets } from "../methods";

let db = client.db, coll = db.collection("tickets"), circleFolder = "https://github.com/PreMiD/Discord-Bot/blob/main/.discord/";


export class Ticket {
    id: string;
    tMsg: Message;
    status: Number;
    userId: string;
    user: GuildMember;
    attachments: any[];
    acceptedAt: string;
    channel: TextChannel;
    ticketMessage: string;
    supportMessage: string;
    supportChannel: string;
    messageContent: string;
    supportTimestamps: number;
    supporters: GuildMember[];

    async fetch(filter: "ticket" | "author" | "id" | "channel" | "message", input: string | Message | TextChannel) {
        let ticket: any;

        filter == "ticket" ? input
            : filter == "channel" ? ticket = await coll.findOne({ supportChannel: input })
            : filter == "message" ? ticket = await coll.findOne({ ticketMessage: input })
            : filter == "author" ? ticket = await coll.findOne({ userId: input })
            : filter == "id" ? ticket = await coll.findOne({ userId: input })
            : ticket = null;

        if(!ticket) return false;

        for (const key of Object.keys(ticket)) this[key] = ticket[key];

        this.id = ticket.ticketId;
        this.tMsg = await (client.channels.cache.get(client.config.channels.ticketChannel) as TextChannel).messages.fetch(ticket.messageMessage);
        this.user = await client.guilds.cache.get(client.config.main_guild).members.fetch(this.userId);

        return true;
    }

    async create(message: Message, confirmed=false) {
        (client.channels.cache.get(client.config.channels.supportChannel) as TextChannel).updateOverwrite(message.member, {
            SEND_MESSAGES: false
        });

        if(!confirmed) {
            let msg = await message.author.send({
                embed: {
                    author: {
                        name: "PreMiD Support",
                        iconURL: client.user.avatarURL()
                    },
                    color: "#7289DA",
                    description: `Before your ticket is created, please have a look through our support guide to see if it can help with your issue!\nhttps://docs.premid.app/troubleshooting\n\n**Continue creating ticket?**`
                }
            });

            msg.react("521018476870107156").then(_ => msg.react("❌"));

            let create = msg.createReactionCollector((x, y) => x.emoji.name == "success" && y.id == message.author.id),
                cancel = msg.createReactionCollector((x, y) => x.emoji.name == "❌" && y.id == message.author.id);

            create.on("collect", _ => {
                msg.delete();
                this.create(message, true);
            });

            cancel.on("collect", _ => msg.delete())
        } else {
            client.ttCount = client.ttCount ? Number(client.ttCount) + 1 : 1;
            setTimeout(() => client.ttCount = Number(client.ttCount) - 1, 60000);
            if(client.ttCount > 5) return (await message.reply("we have had more than 5 tickets created in the last minute, please try again in one minute! This is to reduce spam. You have been DMed your message content so you do not need to retype it all out.")).delete({timeout: 20000});            
            let ticketCount = await coll.countDocuments({}),
                ticketId = (ticketCount++).toString().padStart(5, "0"),
                attachments = [],
                mAttachments = message.attachments.map(x => x);

            this.id = ticketId;

            for await (const attachment of mAttachments)
                attachments.push(await this.attachImage(attachment));


            let embed = {
                    author: {
                        name: `#${ticketId}`,
                        iconURL: `${circleFolder}green_circle.png?raw=true`
                    },
                    description: message.cleanContent,
                    color: "#77ff77",
                    fields: [],
                    footer: {
                        text: message.author.tag,
                        iconURL: message.author.displayAvatarURL({ size: 128 })
                }
            };

            if(attachments.length > 0) embed.fields = [{name: `Attachments`, value: attachments.map(x => `[${x.name}](${x.link})`)}];

            let tMsg = await (client.channels.cache.get(client.config.channels.ticketChannel) as TextChannel).send({embed});
            tMsg.react("521018476870107156");
            tMsg.react("🚫");

            message.author.send(`Your ticket (\`${ticketId}\`) has been submitted!`);
                
            coll.insertOne({
                status: 3,
                ticketId: this.id,
                userId: message.author.id,
                messageContent: message.content,
                ticketMessage: tMsg.id,
                timestamp: Date.now(),
                attachments: attachments,
                created: Date.now(),
                logs: [
                    `[${moment(new Date()).format("DD/MM/YY LT")} (${Date().split("(")[1].replace(")", "").match(/[A-Z]/g).join("")})] [TICKET CREATED] Awaiting supporter!`
                ]
            })
        }
    }

    delete(closer, msg) {
        client.users.cache.get(this.userId).send(`Your ticket (\`${this.id}\`) has been rejected by <@${closer.id}>`);
        (client.channels.cache.get(client.config.channels.ticketChanel) as TextChannel)
        msg.delete();
        coll.findOneAndUpdate({ticketId: this.id}, {$set: {status: 3}});
    }

    async accept(member: GuildMember) {
        let ticketCategory = (await client.channels.fetch(client.config.channels.ticketCategory)) as CategoryChannel;
        if(ticketCategory.children.size >= 50) return member.send("A maximum of 50 tickets is currently open, try accepting a ticket again in a few minutes!");

		const channelPerms = [
			"VIEW_CHANNEL",
			"SEND_MESSAGES",
			"EMBED_LINKS",
			"ATTACH_FILES",
			"USE_EXTERNAL_EMOJIS"
		];

        let channel = await ticketCategory.guild.channels.create(this.id, {
            parent: ticketCategory.id,
            permissionOverwrites: [
                {
					id: ticketCategory.guild.id,
					deny: ["VIEW_CHANNEL"]
				},
				{
					id: this.user.id,
					allow: channelPerms as any
				},
				{
					id: member.id,
					allow: channelPerms as any
				}
            ].concat(
				(
					await db
						.collection("userSettings")
						.find({ showAllTickets: true })
						.toArray()
				).map(uSett => {
					return {
						id: uSett.userId,
						allow: channelPerms
					};
				})
			) as OverwriteResolvable[]
        });

        let embed = {
            author: {
                name: `#${this.id} [Pending]`,
                iconURL: `${circleFolder}yellow_circle.png?raw=true`
            },
            description: this.messageContent,
            color: "#f4dd1a",
            fields: [
                {
                    name: "Supporter",
                    value: member.toString(),
                    inline: true
                },
                {
                    name: "Channel",
                    value: channel.toString(),
                    inline: true
                }
            ],
            footer: {
                text: this.user.user.tag,
                iconURL: this.user.user.displayAvatarURL({ size: 128 })
            }
        };
        
        if(this.attachments.length > 0) embed.fields.push({name: "Attachments", value: this.attachments.map(x => `[${x.name}](${x.url})`).join(", "), inline: true});

        (await (client.channels.cache.get(client.config.channels.ticketChannel) as TextChannel).messages.fetch(this.ticketMessage as string)).edit({embed});

        embed.fields = embed.fields.filter(x => x.name != "Channel");
        embed.footer = { text: "/ticket close - closes the ticket.", iconURL: this.user.user.displayAvatarURL({ size: 128 }) };
        
        let msg = await channel.send({embed});
        channel.send(`${this.user.toString()}, your ticket has been accepted by ${member.toString()}`);

		this.addLog(`[ACCEPTED] Ticket accepted by ${this.user.user.tag}`);
        sortTickets();
        coll.findOneAndUpdate({ticketId: this.id}, {$set: {status: 2, supportChannel: channel.id, supporters: [member.id], acceptedAt: Date.now(), supportMessage: msg.id}});
    }

    async close(closer, reason?) {
        let logs = (await coll.findOne({ticketId: this.id})).logs;
        logs.push(`[${moment(new Date()).format("DD/MM/YY LT")} (${Date().split("(")[1].replace(")", "").match(/[A-Z]/g).join("")})] [CLOSED] Ticket closed by ${closer.tag}`);
        
        await writeFileSync(`${process.cwd()}/TicketLogs/${this.id}.txt`, logs.join("\n"));

        let user = client.users.cache.get(this.userId);
        if(user) user.send(`Your ticket (\`${this.id}\`) has been closed by <@${closer.id}>. (Reason: \`${reason.length > 2 ? reason : "Not Specified"}\`"})`, {
            files: [
                {
                    attachment: `${process.cwd()}/TicketLogs/${this.id}.txt`,
                    name: `Ticket-${this.id}.txt`
                }
            ]
        });

        (await (client.channels.cache.get(client.config.channels.ticketChannel) as TextChannel).messages.fetch(this.ticketMessage as string)).delete();
        client.channels.cache.get(this.supportChannel).delete();

        coll.findOneAndUpdate({ticketId: this.id}, {$set: {status: 3}});

        let vars = getVars(process.env.TICKETLOGSWEBHOOK),
            webhook = new WebhookClient(vars.id, vars.token),
            embed = new client.Embed()
                .setAuthor(`#${this.id}`, "https://github.com/PreMiD/Discord-Bot/blob/main/.discord/red_circle.png?raw=true")
                .setColor("#b52222")
                .setDescription(this.messageContent)
                .addFields([
                    {
                        name: "Creator",
                        value: `<@${this.userId}>`,
                        inline: true
                    },
                    {
                        name: "Closer",
                        value: `<@${closer.id}> (Reason: \`${reason.length > 2 ? reason : "Not Specified"}\`)`,
                        inline: true
                    },
                    {
                        name: "Supporters",
                        value: `${this.supporters.map(x => `<@${x}>`)}`,
                        inline: true
                    }
                ])
                .setFooter(`Chat lasted ${moment.duration(moment(Date.now()).diff(moment(this.acceptedAt))).humanize()}`, client.user.avatarURL());

            if(this.attachments.length > 0) embed.addField("Attachments", this.attachments.map(x => `[${x.name}](${x.url})`).join(", "));

            webhook.send("", {
                embeds: [embed],
                files: [
                    {
                        attachment: `${process.cwd()}/TicketLogs/${this.id}.txt`,
                        name: `Ticket-${this.id}.txt`
                    }
                ]
            })

            rimraf(`${process.cwd()}/TicketLogs/${this.id}.txt`, () => {});
    }

    async addSupporter(msg: Message, args) {
        let user = msg.mentions.users.first() || client.users.cache.get(args[0]) || msg.guild.members.cache.find(m => m.user.username.toLowerCase() == args[0].toLowerCase());

        if(!user) return msg.reply("I could not find that member.");
        
        if(await coll.findOne({ticketId: this.id, supporters: user.id})) return msg.reply("that member is already added to this ticket.");

        msg.channel.send(`**>>** ${msg.author} has added ${user.toString()}`);
        msg.delete();

        (msg.channel as TextChannel).updateOverwrite(user.id, {
            VIEW_CHANNEL: true,
            SEND_MESSAGES: true,
            EMBED_LINKS: true,
            ATTACH_FILES: true,
            USE_EXTERNAL_EMOJIS: true
        })

        coll.findOneAndUpdate({ticketId: this.id}, {$push: {supporters: user.id}});

        this.updateSupportersEmbed(await (client.channels.cache.get(client.config.channels.ticketChannel) as TextChannel).messages.fetch(this.ticketMessage as string));
        this.updateSupportersEmbed(await msg.channel.messages.fetch(this.supportMessage as string));

        this.addLog(`[SUPPORTER ADDED] ${user.toString()} has been added by ${msg.author.toString()}`);
    }

    async removeSupporter(msg, args) {
        let user = msg.mentions.users.first() || client.users.cache.get(args[0]) || msg.guild.members.cache.find(m => m.user.username.toLowerCase() == args[0].toLowerCase());

        if(!user) return msg.reply("I could not find that member.");
        
        if(!await coll.findOne({ticketId: this.id, supporters: user.id})) return msg.reply("that member is not in this ticket.");

        msg.channel.send(`**<<** ${msg.author} has removed ${user.toString()}`);
        msg.delete();

        (msg.channel as TextChannel).updateOverwrite(user.id, {
            VIEW_CHANNEL: false,
            SEND_MESSAGES: false,
            EMBED_LINKS: false,
            ATTACH_FILES: false,
            USE_EXTERNAL_EMOJIS: false
        })

        coll.findOneAndUpdate({ticketId: this.id}, {$pull: {supporters: user.id}});

        this.updateSupportersEmbed(await (client.channels.cache.get(client.config.channels.ticketChannel) as TextChannel).messages.fetch(this.ticketMessage as string));
        this.updateSupportersEmbed(await msg.channel.messages.fetch(this.supportMessage as string));

        this.addLog(`[SUPPORTER REMOVED] ${user.toString()} has been added by ${msg.author.toString()}`);
    }
    
    async updateSupportersEmbed(msg) {
        let embed = msg.embeds[0], fields = embed.fields.filter(x => !x.name.includes("Supporter"));
        
        fields.push({name: "Supporter(s)", value: (await coll.findOne({ticketId: this.id})).supporters.map(x => `<@${x}>`).join(", "), inline: true});
        
        embed.fields = fields;
        msg.edit(embed);
    }

    async attachImage(attachment) {
        let data = new FormData();

        data.append("file", (await axios(attachment.proxyURL, { responseType: "stream" })).data.pipe(createWriteStream(path.resolve(__dirname, attachment.name))));

        await axios.post(`https://cdn.rcd.gg/ticket/${this.id}/${attachment.name}`, data, {
            headers: {
                "Content-Type": "multipart/form-data",
                authorization: process.env.AUTH_CDN
            }
        })
        return {name: attachment.name, link: `https://cdn.rcd.gg/ticket/${this.id}/${attachment.name}`};
    }

    addLog(input: string) {
        coll.findOneAndUpdate({id: this.id}, {$push: {logs: `[${moment(new Date()).format("DD/MM/YY LT")} (${Date().split("(")[1].replace(")", "").match(/[A-Z]/g).join("")})] ${input}`}})
    }
    
    closeWarning() {
        this.addLog("Sent close warning (2 days to respond)");
        this.channel.send(`${this.user.toString()}, ${this.supporters.map(s => s.toString()).join(", ")} You have 2 days to respond to this ticket before it is automatically closed. To keep the ticket open, simply send a message!`);
        coll.findOneAndUpdate({ticketId: this.id}, {$set: {ticketCloseWarning: Date.now()}});
    }
}

//statuses
//1 - pending supporter
//2 - chat open, ticket in progress
//3 - ticket closed