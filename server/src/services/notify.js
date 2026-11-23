import nodemailer from 'nodemailer';
import webpush from 'web-push';
import {User,Notification} from '../models/index.js';
let io;
export function setIO(value){io=value;}
export function getIO(){return io;}
const smtpReady=()=>!!(process.env.SMTP_HOST&&process.env.SMTP_USER&&process.env.SMTP_PASS);
export async function sendEmail(to,subject,text){
  if(!smtpReady())throw new Error('SMTP not configured');
  const transport=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:Number(process.env.SMTP_PORT)===465,auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}});
  return transport.sendMail({from:process.env.SMTP_FROM,to,subject,text});
}
export async function sendTelegram(chatId,text){
  if(!process.env.TELEGRAM_BOT_TOKEN)throw Error('Telegram bot not configured');
  const r=await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:chatId,text,disable_web_page_preview:true}),signal:AbortSignal.timeout(9000)});
  if(!r.ok)throw Error('Telegram API failed: '+r.status);
}
export async function notifyNearby(incident){
  // This targets only opt-in citizens with a location fix received within 2 minutes.
  const users=await User.find({suspended:false,_id:{$ne:incident.reporter},locationUpdatedAt:{$gte:new Date(Date.now()-120000)},lastLocation:{$near:{$geometry:incident.location,$maxDistance:1000}}}).limit(500);
  const title='Nearby hazard — verification requested';
  const message=`A ${incident.category.replaceAll('_',' ')} incident was reported within 1 km. Open CivicAlert to review and vote. Status: Unverified.`;
  const url=(process.env.CITIZEN_ORIGIN||'http://localhost:5173')+'/incidents/'+incident.id;
  if(process.env.VAPID_PUBLIC_KEY&&process.env.VAPID_PRIVATE_KEY)webpush.setVapidDetails(process.env.VAPID_EMAIL||'mailto:admin@example.com',process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY);
  await Promise.allSettled(users.map(async user=>{
    if(user.preferences?.inApp!==false){const notice=await Notification.create({recipient:user._id,incident:incident._id,title,message});io?.to('user:'+user.id).emit('notification',notice.toObject());}
    const sends=[];
    if(user.preferences?.email&&smtpReady())sends.push(sendEmail(user.email,title,message+'\n'+url));
    if(user.preferences?.telegram&&user.telegramChatId&&process.env.TELEGRAM_BOT_TOKEN)sends.push(sendTelegram(user.telegramChatId,message+'\n'+url));
    if(user.preferences?.push&&process.env.VAPID_PRIVATE_KEY)for(const subscription of user.pushSubscriptions||[])sends.push(webpush.sendNotification(subscription,JSON.stringify({title,body:message,url})).catch(()=>{}));
    await Promise.allSettled(sends);
  }));
  io?.emit('incident:new',{id:incident.id});
}
