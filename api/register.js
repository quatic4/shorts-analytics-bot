import { requireEnv } from "../lib/env.js";
const commands=[
{name:"setup",description:"Choose the channel for automatic daily reports",options:[{type:7,name:"channel",description:"Discord channel for reports",required:true,channel_types:[0,5]}]},
{name:"uploadsetup",description:"Ping @everyone whenever a tracked YouTube channel uploads",options:[{type:7,name:"channel",description:"Discord channel for upload alerts",required:true,channel_types:[0,5]}]},
{name:"uploadstatus",description:"Show the current YouTube upload notifier settings"},
{name:"add",description:"Track any YouTube channel publicly by @handle",options:[{type:3,name:"handle",description:"YouTube @handle, e.g. @MrBeast",required:true}]},
{name:"remove",description:"Stop publicly tracking a YouTube channel",options:[{type:3,name:"handle",description:"YouTube @handle to remove",required:true}]},
{name:"channels",description:"Show tracked and connected YouTube channels"},
{name:"publicstats",description:"Show public YouTube stats without owner login",options:[{type:3,name:"handle",description:"Optional @handle; omit for all tracked channels",required:false}]},
{name:"connect",description:"Owner mode: connect YouTube for full Shorts analytics"},
{name:"analytics",description:"Owner mode: latest private Shorts analytics"},
{name:"today",description:"Show today's stats for all connected and added channels"},
{name:"week",description:"Owner mode: last 7 complete days of Shorts analytics"}
];
export default async function handler(req,res){const s=process.env.SETUP_SECRET;if(!s||req.query?.secret!==s)return res.status(401).send("Unauthorized");const r=await fetch(`https://discord.com/api/v10/applications/${requireEnv("DISCORD_APPLICATION_ID")}/commands`,{method:"PUT",headers:{Authorization:`Bot ${requireEnv("DISCORD_BOT_TOKEN")}`,"Content-Type":"application/json"},body:JSON.stringify(commands)});const b=await r.text();res.status(r.status).setHeader("Content-Type","application/json");return res.send(b)}
