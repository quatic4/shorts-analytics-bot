import { getConfiguredGuilds,getGuildConfig,getDailySnapshot,setDailySnapshot } from "../../lib/redis.js";
import { getShortsAnalytics,fetchPublicChannelById } from "../../lib/youtube.js";
import { analyticsEmbed,publicStatsEmbed } from "../../lib/report.js";
import { sendChannelMessage } from "../../lib/discord.js";
import { renewAllUploadSubscriptions } from "../../lib/uploadNotifications.js";

export default async function handler(req,res){
  const auth=req.headers.authorization;
  if(process.env.CRON_SECRET&&auth!==`Bearer ${process.env.CRON_SECRET}`)return res.status(401).json({ok:false});
  const guilds=await getConfiguredGuilds(),results=[];

  for(const guildId of guilds){
    try{
      const c=await getGuildConfig(guildId);
      if(!c?.reportChannelId){results.push({guildId,ok:true,skipped:"no report channel"});continue}

      if(c.youtubeTokens){
        try{
          const d=await getShortsAnalytics(c.youtubeTokens,1);
          await sendChannelMessage(c.reportChannelId,{embeds:[analyticsEmbed(d,"Daily Shorts Report")],allowed_mentions:{parse:[]}})
        }catch(e){console.error("Owner daily report failed:",e)}
      }

      const tracked=Array.isArray(c.publicChannels)?c.publicChannels:[];
      for(const t of tracked.slice(0,10)){
        try{
          const d=await fetchPublicChannelById(t.channelId);
          let p=await getDailySnapshot(guildId,t.channelId);
          if(!p)p=d;
          await sendChannelMessage(c.reportChannelId,{
            embeds:[publicStatsEmbed(d,p,"Daily Public Update")],
            allowed_mentions:{parse:[]}
          });
          await setDailySnapshot(guildId,t.channelId,d);
        }catch(e){console.error("Public daily report failed:",t.channelId,e)}
      }

      results.push({guildId,ok:true})
    }catch(e){
      console.error(e);
      results.push({guildId,ok:false})
    }
  }

  const renewed=await renewAllUploadSubscriptions();
  return res.status(200).json({ok:true,processed:results.length,uploadSubscriptionsRenewed:renewed,results})
}
