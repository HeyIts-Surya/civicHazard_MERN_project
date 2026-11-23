import {Router} from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import {Admin,Incident,User,AuthorityContact,AuthorityDispatch} from '../models/index.js';
import {admin,requireMain,requirePermission,issueSession,clearSession} from '../middleware/auth.js';
import {draftAuthorityEmail} from '../services/ai.js';
import {sendEmail} from '../services/notify.js';
import {audit} from '../services/audit.js';
import {safeText} from '../utils/logic.js';
const router=Router();
const idOK=id=>mongoose.isValidObjectId(id);
const serializeAdmin=a=>({id:a.id,username:a.username,role:a.role,permissions:a.permissions,mustChangePassword:a.mustChangePassword});
router.post('/login',async(req,res,next)=>{try{
  const username=safeText(req.body?.username,100).toLowerCase();const password=String(req.body?.password||'');
  const account=await Admin.findOne({username,disabled:false});
  if(!account||!await bcrypt.compare(password,account.passwordHash))return res.status(401).json({error:'Invalid credentials'});
  issueSession(res,'admin',account._id);res.json({admin:serializeAdmin(account)});
}catch(e){next(e);}});
router.post('/logout',(req,res)=>{clearSession(res,'admin');res.json({ok:true});});
router.get('/me',admin,(req,res)=>res.json({admin:serializeAdmin(req.admin)}));
router.post('/change-password',admin,async(req,res,next)=>{try{
  const {oldPassword,newPassword}=req.body;
  if(typeof newPassword!=='string'||newPassword.length<14||newPassword.length>128)return res.status(400).json({error:'Use a password of 14–128 characters'});
  if(!await bcrypt.compare(String(oldPassword||''),req.admin.passwordHash))return res.status(401).json({error:'Incorrect current password'});
  req.admin.passwordHash=await bcrypt.hash(newPassword,12);req.admin.mustChangePassword=false;await req.admin.save();await audit(req,'admin.password.changed','admin',req.admin._id);res.json({ok:true});
}catch(e){next(e);}});
router.use(admin);
router.use((req,res,next)=>{if(req.admin.mustChangePassword)return res.status(403).json({error:'Change your temporary password before continuing',code:'PASSWORD_CHANGE_REQUIRED'});next();});
router.get('/stats',requirePermission('incidents.read'),async(req,res,next)=>{try{
  const [total,pending,verified,users,hidden,contacts]=await Promise.all([
    Incident.countDocuments({deletedAt:{$exists:false}}),Incident.countDocuments({verification:'unverified',visibility:'public',deletedAt:{$exists:false}}),
    Incident.countDocuments({verification:'community_verified',visibility:'public',deletedAt:{$exists:false}}),User.countDocuments(),Incident.countDocuments({visibility:'hidden',deletedAt:{$exists:false}}),AuthorityContact.countDocuments({active:true})]);
  res.json({total,pending,verified,users,hidden,contacts});
}catch(e){next(e);}});
router.get('/incidents',requirePermission('incidents.read'),async(req,res,next)=>{try{const data=await Incident.find({deletedAt:{$exists:false}}).sort({createdAt:-1}).limit(150).populate('reporter','name email').lean();res.json({incidents:data});}catch(e){next(e);}});
router.patch('/incidents/:id/moderate',requirePermission('incidents.moderate'),async(req,res,next)=>{try{
  if(!idOK(req.params.id)||!['hide','restore'].includes(req.body.action))return res.status(400).json({error:'Invalid incident/action'});
  const item=await Incident.findOne({_id:req.params.id,deletedAt:{$exists:false}});if(!item)return res.status(404).json({error:'Not found'});
  item.visibility=req.body.action==='hide'?'hidden':'public';await item.save();await audit(req,'incident.'+req.body.action,'incident',item._id);res.json({incident:item});
}catch(e){next(e);}});
router.get('/users',requirePermission('users.read'),async(req,res,next)=>{try{res.json({users:await User.find().select('-pushSubscriptions -telegramLinkHash -telegramChatId -lastLocation').sort({createdAt:-1}).limit(200).lean()});}catch(e){next(e);}});
router.patch('/users/:id',requirePermission('users.manage'),async(req,res,next)=>{try{if(!idOK(req.params.id)||typeof req.body.suspended!=='boolean')return res.status(400).json({error:'Invalid user or status'});const u=await User.findByIdAndUpdate(req.params.id,{$set:{suspended:req.body.suspended}},{new:true});if(!u)return res.status(404).json({error:'Not found'});await audit(req,'user.suspension','user',u._id,{suspended:u.suspended});res.json({ok:true});}catch(e){next(e);}});
router.get('/contacts',requirePermission('contacts.read'),async(req,res,next)=>{try{res.json({contacts:await AuthorityContact.find().sort({state:1,district:1}).limit(200).lean()});}catch(e){next(e);}});
router.post('/contacts',requirePermission('contacts.manage'),async(req,res,next)=>{try{
  const {department,email,district,state,categories=[],verifiedContact=false}=req.body;
  if(!department||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email||'')||!district||!state)return res.status(400).json({error:'Department, valid email, district and state are required'});
  const c=await AuthorityContact.create({department:safeText(department,120),email:safeText(email,190),district:safeText(district,100),state:safeText(state,100),categories:Array.isArray(categories)?categories.map(c=>safeText(c,40)).slice(0,30):[],verifiedContact:verifiedContact===true});await audit(req,'contact.create','authorityContact',c._id);res.status(201).json({contact:c});
}catch(e){next(e);}});
router.patch('/contacts/:id',requirePermission('contacts.manage'),async(req,res,next)=>{try{
  if(!idOK(req.params.id))return res.status(400).json({error:'Invalid contact'});
  const fields=['department','email','district','state','active','verifiedContact','categories'];const data={};for(const key of fields)if(req.body[key]!==undefined)data[key]=req.body[key];
  if(data.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))return res.status(400).json({error:'Invalid email'});
  const c=await AuthorityContact.findByIdAndUpdate(req.params.id,{$set:data},{new:true,runValidators:true});if(!c)return res.status(404).json({error:'Not found'});await audit(req,'contact.edit','authorityContact',c._id);res.json({contact:c});
}catch(e){next(e);}});
router.post('/incidents/:id/draft',requirePermission('authority.draft'),async(req,res,next)=>{try{
  if(!idOK(req.params.id)||!idOK(req.body.contactId))return res.status(400).json({error:'Select an incident and authority contact'});
  const incident=await Incident.findOne({_id:req.params.id,deletedAt:{$exists:false}});const contact=await AuthorityContact.findOne({_id:req.body.contactId,active:true});
  if(!incident||!contact)return res.status(404).json({error:'Incident or contact not found'});
  res.json({draft:await draftAuthorityEmail(incident,contact),recipient:{email:contact.email,department:contact.department,verifiedContact:contact.verifiedContact}});
}catch(e){next(e);}});
router.post('/incidents/:id/send',requirePermission('authority.send'),async(req,res,next)=>{try{
  if(!idOK(req.params.id)||!idOK(req.body.contactId))return res.status(400).json({error:'Invalid recipient or incident'});
  const incident=await Incident.findOne({_id:req.params.id,deletedAt:{$exists:false}});const contact=await AuthorityContact.findOne({_id:req.body.contactId,active:true,verifiedContact:true});
  if(!incident||!contact)return res.status(400).json({error:'Only active, independently verified authority contacts can receive reports'});
  const subject=safeText(req.body.subject,160),body=safeText(req.body.body,8000);
  if(subject.length<8||body.length<40)return res.status(400).json({error:'Review and provide a subject and email body'});
  // Explicit admin action is required: generation alone never sends emails.
  const mail=await sendEmail(contact.email,subject,body);
  const dispatch=await AuthorityDispatch.create({incident:incident._id,contact:contact._id,byAdmin:req.admin._id,subject,body,sentAt:new Date(),messageId:mail.messageId});
  await audit(req,'authority.email.sent','incident',incident._id,{contact:contact._id,dispatch:dispatch._id});res.json({ok:true,dispatchId:dispatch.id});
}catch(e){next(e);}});
router.get('/dispatches',requirePermission('authority.draft'),async(req,res,next)=>{try{res.json({dispatches:await AuthorityDispatch.find().sort({sentAt:-1}).limit(50).populate('contact','email department').lean()});}catch(e){next(e);}});
router.get('/subadmins',requireMain,async(req,res,next)=>{try{res.json({admins:await Admin.find({role:'sub'}).select('-passwordHash').sort({createdAt:-1}).lean()});}catch(e){next(e);}});
router.post('/subadmins',requireMain,async(req,res,next)=>{try{
  const username=safeText(req.body.username,60).toLowerCase();const password=String(req.body.password||'');
  if(!/^[a-z0-9._-]{4,60}$/.test(username)||password.length<14)return res.status(400).json({error:'Username (4+ letters/numbers) and temporary password (14+ characters) required'});
  const allowed=['incidents.read','incidents.moderate','users.read','users.manage','contacts.read','contacts.manage','authority.draft','authority.send'];
  const permissions=Array.isArray(req.body.permissions)?req.body.permissions.filter(p=>allowed.includes(p)):[];
  const a=await Admin.create({username,passwordHash:await bcrypt.hash(password,12),role:'sub',mustChangePassword:true,permissions});await audit(req,'subadmin.create','admin',a._id);res.status(201).json({admin:serializeAdmin(a)});
}catch(e){if(e.code===11000)return res.status(409).json({error:'Username already exists'});next(e);}});
router.patch('/subadmins/:id',requireMain,async(req,res,next)=>{try{
  if(!idOK(req.params.id))return res.status(400).json({error:'Invalid admin'});const a=await Admin.findOne({_id:req.params.id,role:'sub'});if(!a)return res.status(404).json({error:'Not found'});
  if(typeof req.body.disabled==='boolean')a.disabled=req.body.disabled;
  if(Array.isArray(req.body.permissions)){const allowed=['incidents.read','incidents.moderate','users.read','users.manage','contacts.read','contacts.manage','authority.draft','authority.send'];a.permissions=req.body.permissions.filter(p=>allowed.includes(p));}
  if(req.body.newPassword){if(String(req.body.newPassword).length<14)return res.status(400).json({error:'Password must have 14+ characters'});a.passwordHash=await bcrypt.hash(req.body.newPassword,12);a.mustChangePassword=true;}
  await a.save();await audit(req,'subadmin.update','admin',a._id);res.json({admin:serializeAdmin(a)});
}catch(e){next(e);}});
export default router;
