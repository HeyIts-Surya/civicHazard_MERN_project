import {Router} from 'express';
import {OAuth2Client} from 'google-auth-library';
import {User} from '../models/index.js';
import {citizen,issueSession,clearSession} from '../middleware/auth.js';
import {coordinatesValid} from '../utils/logic.js';
const router=Router();
router.post('/google',async(req,res,next)=>{try{
  if(!process.env.GOOGLE_CLIENT_ID)return res.status(503).json({error:'Google OAuth not configured'});
  const credential=req.body?.credential;
  if(typeof credential!=='string'||credential.length>10000)return res.status(400).json({error:'Google credential is required'});
  const ticket=await new OAuth2Client(process.env.GOOGLE_CLIENT_ID).verifyIdToken({idToken:credential,audience:process.env.GOOGLE_CLIENT_ID});
  const p=ticket.getPayload();if(!p?.email_verified||!p?.sub)return res.status(401).json({error:'Google email verification required'});
  let user=await User.findOne({googleId:p.sub});
  if(!user){const byEmail=await User.findOne({email:p.email.toLowerCase()});if(byEmail&&byEmail.googleId!==p.sub)return res.status(409).json({error:'An account with this email exists'});
    user=await User.create({googleId:p.sub,email:p.email,name:p.name||p.email,avatar:p.picture});}
  if(user.suspended)return res.status(403).json({error:'Account suspended'});
  issueSession(res,'citizen',user._id);res.json({user:publicUser(user)});
}catch(e){next(e);}});
router.get('/me',citizen,(req,res)=>res.json({user:publicUser(req.user)}));
router.post('/logout',(req,res)=>{clearSession(res,'citizen');res.json({ok:true});});
router.patch('/preferences',citizen,async(req,res,next)=>{try{
  const allowed=['inApp','email','telegram','push'];for(const key of allowed)if(typeof req.body?.[key]==='boolean')req.user.preferences[key]=req.body[key];
  await req.user.save();res.json({user:publicUser(req.user)});
}catch(e){next(e);}});
router.post('/location',citizen,async(req,res,next)=>{try{
  const lat=Number(req.body.lat),lng=Number(req.body.lng);
  if(!coordinatesValid(lat,lng))return res.status(400).json({error:'Invalid latitude or longitude'});
  const accuracy=Number(req.body.accuracy);
  if(!Number.isFinite(accuracy)||accuracy>150||accuracy<0)return res.status(400).json({error:'A recent, accurate GPS fix (within 150 m) is required'});
  req.user.lastLocation={type:'Point',coordinates:[lng,lat]};req.user.locationUpdatedAt=new Date();await req.user.save();
  res.json({ok:true,updatedAt:req.user.locationUpdatedAt});
}catch(e){next(e);}});
function publicUser(u){return {id:u.id,name:u.name,email:u.email,avatar:u.avatar,preferences:u.preferences,telegramConnected:!!u.telegramChatId,locationUpdatedAt:u.locationUpdatedAt};}
export default router;
