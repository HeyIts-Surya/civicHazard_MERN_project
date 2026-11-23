import {Router} from 'express';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import {Notification,User} from '../models/index.js';
import {citizen} from '../middleware/auth.js';
const router=Router();
router.get('/',citizen,async(req,res,next)=>{try{res.json({notifications:await Notification.find({recipient:req.user._id}).sort({createdAt:-1}).limit(100).lean()});}catch(e){next(e);}});
router.patch('/read-all',citizen,async(req,res,next)=>{try{await Notification.updateMany({recipient:req.user._id},{$set:{read:true}});res.json({ok:true});}catch(e){next(e);}});
router.patch('/:id/read',citizen,async(req,res,next)=>{try{if(!mongoose.isValidObjectId(req.params.id))return res.status(404).json({error:'Not found'});await Notification.updateOne({_id:req.params.id,recipient:req.user._id},{$set:{read:true}});res.json({ok:true});}catch(e){next(e);}});
router.post('/push/subscribe',citizen,async(req,res,next)=>{try{
  const s=req.body?.subscription;if(!s||typeof s.endpoint!=='string'||!s.endpoint.startsWith('https://')||!s.keys?.p256dh||!s.keys?.auth)return res.status(400).json({error:'Valid push subscription required'});
  req.user.pushSubscriptions=req.user.pushSubscriptions.filter(v=>v.endpoint!==s.endpoint).slice(-3);req.user.pushSubscriptions.push(s);req.user.preferences.push=true;await req.user.save();res.json({ok:true});
}catch(e){next(e);}});
router.post('/telegram/link',citizen,async(req,res,next)=>{try{
  if(!process.env.TELEGRAM_BOT_USERNAME||!process.env.TELEGRAM_BOT_TOKEN)return res.status(503).json({error:'Telegram integration not configured'});
  const token=crypto.randomBytes(24).toString('hex');req.user.telegramLinkHash=crypto.createHash('sha256').update(token).digest('hex');req.user.telegramLinkExpires=new Date(Date.now()+15*60000);await req.user.save();
  res.json({url:`https://t.me/${process.env.TELEGRAM_BOT_USERNAME.replace('@','')}?start=${token}`,expiresInSeconds:900});
}catch(e){next(e);}});
// Telegram webhook: set via Telegram setWebhook and a secret token; Telegram users must start the bot.
router.post('/telegram/webhook',async(req,res,next)=>{try{
  if(!process.env.TELEGRAM_WEBHOOK_SECRET||req.get('X-Telegram-Bot-Api-Secret-Token')!==process.env.TELEGRAM_WEBHOOK_SECRET)return res.status(403).json({error:'Forbidden'});
  const message=req.body?.message, match=String(message?.text||'').match(/^\/start\s+([a-f0-9]{48})$/);
  if(match&&message?.chat?.id){const hash=crypto.createHash('sha256').update(match[1]).digest('hex');const u=await User.findOne({telegramLinkHash:hash,telegramLinkExpires:{$gt:new Date()}});
    if(u){u.telegramChatId=String(message.chat.id);u.telegramLinkHash=undefined;u.telegramLinkExpires=undefined;u.preferences.telegram=true;await u.save();}}
  res.json({ok:true});
}catch(e){next(e);}});
export default router;
