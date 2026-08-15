import { verifyDiscordRequest, ephemeral, sendChannelMessage } from "../lib/discord.js";
import { getGuildConfig,setGuildConfig,getPublicSnapshot,setPublicSnapshot,deletePublicSnapshot } from "../lib/redis.js";
import { getAuthUrl,getShortsAnalytics,resolvePublicChannel,fetchPublicChannelById } from "../lib/youtube.js";
import { subscribeChannel,subscribeGuildChannels } from "../lib/uploadNotifications.js";
import { makeState } from "../lib/state.js";
import { analyticsEmbed,publicStatsEmbed } from "../lib/report.js";
export const config={api:{bodyParser:false}};
const MAX_PUBLIC_CHANNELS=10;
async function readRaw(req){const a=[];for await(const c of req)a.push(c);return Buffer.concat(a).toString("utf8")}
function option(i,n){return i.data?.options?.find(x=>x.name===n)?.value}
function hasManageGuild(i){const r=i.member?.permissions;if(!r)return false;return (BigInt(r)&BigInt(0x20))===BigInt(0x20)}
function norm(h){let v=String(h||"").trim();if(v.includes("youtube.com/@"))v=v.split("youtube.com/@")[1].split(/[/?#]/)[0];return v.replace(/^@/,"").toLowerCase()}
export default async function handler(req,res){if(req.method!=="POST")return res.status(405).send("Method Not Allowed");const raw=await readRaw(req);if(!verifyDiscordRequest(req,raw))return res.status(401).send("Invalid signature");const i=JSON.parse(raw);if(i.type===1)return res.status(200).json({type:1});if(i.type!==2)return res.status(200).json(ephemeral("Unsupported interaction."));const guildId=i.guild_id,userId=i.member?.user?.id||i.user?.id,cmd=i.data?.name;if(!guildId)return res.status(200).json(ephemeral("Use this command inside a Discord server."));try{
if(cmd==="setup"){if(!hasManageGuild(i))return res.status(200).json(ephemeral("You need **Manage Server** permission."));const channelId=String(option(i,"channel")||i.channel_id),c=await getGuildConfig(guildId)||{};await setGuildConfig(guildId,{...c,reportChannelId:channelId,publicChannels:c.publicChannels||[],updatedAt:new Date().toISOString()});return res.status(200).json(ephemeral(`✅ Daily reports will post in <#${channelId}>. Use **/add @handle** for public mode or **/connect** for owner mode.`))}
if(cmd==="uploadsetup"){if(!hasManageGuild(i))return res.status(200).json(ephemeral("You need **Manage Server** permission."));const channelId=String(option(i,"channel")),c=await getGuildConfig(guildId)||{};const updated={...c,uploadNotifyChannelId:channelId,uploadNotifyRoleId:null,updatedAt:new Date().toISOString()};await setGuildConfig(guildId,updated);const count=await subscribeGuildChannels(updated);return res.status(200).json(ephemeral(`🔔 Upload notifier enabled in <#${channelId}> and will ping **@everyone**. Watching **${count}** connected/added YouTube channel${count===1?"":"s"}. Future channels added with **/add** will be watched automatically.`))}
if(cmd==="uploadstatus"){const c=await getGuildConfig(guildId)||{};if(!c.uploadNotifyChannelId)return res.status(200).json(ephemeral("Upload notifier is not configured yet. Use **/uploadsetup**."));const tracked=new Set([c.youtubeChannel?.channelId,...(Array.isArray(c.publicChannels)?c.publicChannels.map(x=>x.channelId):[]).filter(Boolean)]).size;return res.status(200).json(ephemeral(`🔔 **Upload notifier is ON**\nChannel: <#${c.uploadNotifyChannelId}>\nPing role: ${c.uploadNotifyRoleId?`<@&${c.uploadNotifyRoleId}>`:"None"}\nWatching: **${tracked}** YouTube channel${tracked===1?"":"s"}`))}
if(cmd==="connect"){if(!hasManageGuild(i))return res.status(200).json(ephemeral("You need **Manage Server** permission."));const url=getAuthUrl(makeState({guildId,userId}));return res.status(200).json(ephemeral(`🔐 **Owner mode**
${url}

Connect the channel owner account for full Shorts analytics.`))}
if(cmd==="add"){if(!hasManageGuild(i))return res.status(200).json(ephemeral("You need **Manage Server** permission."));const ch=await resolvePublicChannel(option(i,"handle")),c=await getGuildConfig(guildId)||{},arr=Array.isArray(c.publicChannels)?c.publicChannels:[];if(arr.some(x=>x.channelId===ch.channelId))return res.status(200).json(ephemeral(`**${ch.title}** is already tracked.`));if(arr.length>=MAX_PUBLIC_CHANNELS)return res.status(200).json(ephemeral(`Maximum ${MAX_PUBLIC_CHANNELS} public channels per server.`));const t={channelId:ch.channelId,handle:ch.handle||ch.inputHandle,title:ch.title,thumbnail:ch.thumbnail,addedAt:new Date().toISOString()};await setGuildConfig(guildId,{...c,publicChannels:[...arr,t],updatedAt:new Date().toISOString()});await setPublicSnapshot(guildId,ch.channelId,ch);if(c.uploadNotifyChannelId){try{await subscribeChannel(ch.channelId)}catch(e){console.error("Auto-subscribe after /add failed:",e)}}return res.status(200).json({type:4,data:{content:`✅ Added **${ch.title}** to public tracking.${c.uploadNotifyChannelId?" 🔔 Upload notifications enabled for it too.":""}`,embeds:[publicStatsEmbed(ch,null,"Tracking Started")],allowed_mentions:{parse:[]}}})}
if(cmd==="remove"){if(!hasManageGuild(i))return res.status(200).json(ephemeral("You need **Manage Server** permission."));const wanted=norm(option(i,"handle")),c=await getGuildConfig(guildId)||{},arr=Array.isArray(c.publicChannels)?c.publicChannels:[],f=arr.find(x=>norm(x.handle)===wanted||x.channelId.toLowerCase()===wanted);if(!f)return res.status(200).json(ephemeral("That channel is not tracked."));await setGuildConfig(guildId,{...c,publicChannels:arr.filter(x=>x.channelId!==f.channelId),updatedAt:new Date().toISOString()});await deletePublicSnapshot(guildId,f.channelId);return res.status(200).json(ephemeral(`🗑️ Removed **${f.title}**.`))}
if(cmd==="channels"){const c=await getGuildConfig(guildId)||{},arr=Array.isArray(c.publicChannels)?c.publicChannels:[];const p=arr.length?arr.map((x,j)=>`${j+1}. **${x.title}** ${x.handle||""}`).join("\n"):"_None yet._";return res.status(200).json(ephemeral(`**Tracked channels**\n\n🌐 **Public mode**\n${p}\n\n🔐 **Owner mode**\n${c.youtubeChannel?.title?`**${c.youtubeChannel.title}** connected.`:"_Not connected._"}`))}
if(cmd==="publicstats"){const input=option(i,"handle");if(input){const ch=await resolvePublicChannel(input),p=await getPublicSnapshot(guildId,ch.channelId);await setPublicSnapshot(guildId,ch.channelId,ch);return res.status(200).json({type:4,data:{embeds:[publicStatsEmbed(ch,p)],allowed_mentions:{parse:[]}}})}const c=await getGuildConfig(guildId)||{},arr=Array.isArray(c.publicChannels)?c.publicChannels:[];if(!arr.length)return res.status(200).json(ephemeral("No public channels tracked. Use **/add @handle**."));const embeds=[];for(const t of arr){const ch=await fetchPublicChannelById(t.channelId),p=await getPublicSnapshot(guildId,t.channelId);await setPublicSnapshot(guildId,t.channelId,ch);embeds.push(publicStatsEmbed(ch,p))}return res.status(200).json({type:4,data:{embeds,allowed_mentions:{parse:[]}}})}
if(cmd==="today"){
  const c=await getGuildConfig(guildId)||{};
  const embeds=[];
  const tracked=Array.isArray(c.publicChannels)?c.publicChannels:[];

  if(c.youtubeTokens){
    try{
      const owner=await getShortsAnalytics(c.youtubeTokens,1);
      embeds.push(analyticsEmbed(owner,"Today"));
    }catch(e){console.error("Owner /today failed:",e)}
  }

  for(const t of tracked){
    try{
      const ch=await fetchPublicChannelById(t.channelId);
      const p=await getPublicSnapshot(guildId,t.channelId);
      await setPublicSnapshot(guildId,t.channelId,ch);
      embeds.push(publicStatsEmbed(ch,p,"Today"));
    }catch(e){
      console.error(`Public /today failed for ${t.channelId}:`,e);
    }
  }

  if(!embeds.length)return res.status(200).json(ephemeral("No channels are connected or added yet. Use **/connect** or **/add @handle**."));
  return res.status(200).json({type:4,data:{content:"📊 **Today's channel overview**",embeds:embeds.slice(0,10),allowed_mentions:{parse:[]}}})
}
if(["analytics","week"].includes(cmd)){const c=await getGuildConfig(guildId);if(!c?.youtubeTokens)return res.status(200).json(ephemeral("No owner-mode channel connected. Use **/connect**, or use **/add @handle** + **/publicstats** for public mode."));const days=cmd==="week"?7:1,label=cmd==="week"?"Last 7 complete days":"Today",d=await getShortsAnalytics(c.youtubeTokens,days);return res.status(200).json({type:4,data:{embeds:[analyticsEmbed(d,label)],allowed_mentions:{parse:[]}}})}
return res.status(200).json(ephemeral("Unknown command."));}catch(e){console.error(e);return res.status(200).json(ephemeral(`⚠️ ${e?.message||"Something went wrong."}`))}}
