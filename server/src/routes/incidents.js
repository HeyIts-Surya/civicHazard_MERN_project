import {Router} from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import {Incident,Vote,Notification} from '../models/index.js';
import {citizen} from '../middleware/auth.js';
import {uploadImage,deleteImage} from '../services/imagekit.js';
import {analyzeIncident} from '../services/ai.js';
import {notifyNearby,getIO} from '../services/notify.js';
import {audit} from '../services/audit.js';
import {coordinatesValid,distanceMeters,similarity,safeText,votingResult} from '../utils/logic.js';
const router=Router();
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:6*1024*1024},fileFilter:(_req,file,cb)=>{if(!['image/jpeg','image/png','image/webp'].includes(file.mimetype))return cb(Object.assign(new Error('Only JPG, PNG and WebP are supported'),{status:400}));cb(null,true);}});
const validId=id=>mongoose.isValidObjectId(id);
const publicFilter={deletedAt:{$exists:false},visibility:'public'};
function parseCoords(data){const lat=Number(data.lat),lng=Number(data.lng);return coordinatesValid(lat,lng)?{lat,lng}:null;}
router.get('/',async(req,res,next)=>{try{
  const coords=parseCoords(req.query);if(!coords)return res.status(400).json({error:'Location is required: supply valid lat and lng'});
  const radius=Math.min(Math.max(Number(req.query.radius)||5000,100),50000);
  const filter={...publicFilter,location:{$near:{$geometry:{type:'Point',coordinates:[coords.lng,coords.lat]},$maxDistance:radius}}};
  if(req.query.category&&req.query.category!=='all')filter.category=String(req.query.category).slice(0,40);
  if(req.query.verified==='true')filter.verification='community_verified';
  const incidents=await Incident.find(filter).select('-possibleDuplicates').limit(100).lean();
  res.json({incidents,radius});
}catch(e){next(e);}});
router.get('/mine',citizen,async(req,res,next)=>{try{const incidents=await Incident.find({reporter:req.user._id,deletedAt:{$exists:false}}).sort({createdAt:-1}).limit(100).lean();res.json({incidents});}catch(e){next(e);}});
router.get('/:id',async(req,res,next)=>{try{
  if(!validId(req.params.id))return res.status(404).json({error:'Incident not found'});
  const incident=await Incident.findOne({_id:req.params.id,...publicFilter}).lean();
  if(!incident)return res.status(404).json({error:'Incident not found'});res.json({incident});
}catch(e){next(e);}});
router.post('/',citizen,upload.single('photo'),async(req,res,next)=>{let uploaded;try{
  const coords=parseCoords(req.body);const description=safeText(req.body.description);
  if(!coords||description.length<15||description.length>3000||!req.file)return res.status(400).json({error:'Valid GPS coordinates, a 15–3000 character description, and an image are required'});
  uploaded=await uploadImage(req.file);
  // AI failure or inconclusive results never block publication; status remains Unverified.
  const analysis=await analyzeIncident({description,imageBuffer:req.file.buffer,mimeType:req.file.mimetype});
  const nearby=await Incident.find({...publicFilter,createdAt:{$gte:new Date(Date.now()-6*3600000)},location:{$near:{$geometry:{type:'Point',coordinates:[coords.lng,coords.lat]},$maxDistance:200}}}).limit(12).select('description').lean();
  const duplicates=nearby.filter(i=>similarity(description,i.description)>=0.48).map(i=>i._id);
  const incident=await Incident.create({reporter:req.user._id,description,image:uploaded,location:{type:'Point',coordinates:[coords.lng,coords.lat]},category:analysis.category,severity:analysis.severity,ai:{state:analysis.state,warning:analysis.warning,summary:analysis.summary,model:analysis.model,assessedAt:new Date()},verification:'unverified',possibleDuplicates:duplicates});
  await audit(req,'incident.create','incident',incident._id,{aiState:analysis.state});
  // Best effort: no notification provider outage should undo a successfully saved incident.
  notifyNearby(incident).catch(e=>console.error('Notification dispatch:',e.message));
  res.status(201).json({incident});
}catch(e){if(uploaded?.fileId)deleteImage(uploaded.fileId).catch(()=>{});next(e);}});
router.patch('/:id',citizen,upload.single('photo'),async(req,res,next)=>{let replacement;try{
  if(!validId(req.params.id))return res.status(404).json({error:'Not found'});
  const incident=await Incident.findOne({_id:req.params.id,reporter:req.user._id,deletedAt:{$exists:false}});
  if(!incident)return res.status(404).json({error:'Report not found or not owned by you'});
  const description=safeText(req.body.description||incident.description);
  if(description.length<15)return res.status(400).json({error:'Description must contain at least 15 characters'});
  const oldImage={...incident.image?.toObject?.()||{}};
  if(req.file)replacement=await uploadImage(req.file);
  const image=replacement||oldImage;
  // If only description was edited, obtain the existing image via its URL for AI analysis is optional; don't falsely claim image re-checked.
  const ai=await analyzeIncident({description,imageBuffer:req.file?.buffer,mimeType:req.file?.mimetype});
  incident.description=description;incident.image=image;incident.category=ai.category;incident.severity=ai.severity;
  incident.ai={state:ai.state,warning:req.file?ai.warning:'Edited report; image not re-analyzed. '+(ai.warning||''),summary:ai.summary,model:ai.model,assessedAt:new Date()};
  incident.verification='unverified';incident.yesCount=0;incident.noCount=0;
  await incident.save();await Vote.deleteMany({incident:incident._id});
  if(replacement?.fileId&&oldImage.fileId)deleteImage(oldImage.fileId).catch(e=>console.error('Old image cleanup:',e.message));
  await audit(req,'incident.edit','incident',incident._id);getIO()?.emit('incident:updated',{id:incident.id});res.json({incident});
}catch(e){if(replacement?.fileId)deleteImage(replacement.fileId).catch(()=>{});next(e);}});
router.delete('/:id',citizen,async(req,res,next)=>{try{
  if(!validId(req.params.id))return res.status(404).json({error:'Not found'});
  const incident=await Incident.findOne({_id:req.params.id,reporter:req.user._id,deletedAt:{$exists:false}});
  if(!incident)return res.status(404).json({error:'Report not found or not owned by you'});
  const fileId=incident.image?.fileId;
  // Minimize retained data; preserve only ownership, timestamps and deletion status for audit.
  await Incident.updateOne({_id:incident._id},{$set:{deletedAt:new Date(),deletedBy:req.user._id,visibility:'hidden',verification:'unverified',yesCount:0,noCount:0},$unset:{description:'',image:'',location:'',ai:'',possibleDuplicates:''}});
  await Vote.deleteMany({incident:incident._id});await Notification.deleteMany({incident:incident._id});
  await audit(req,'incident.delete','incident',incident._id);
  if(fileId)deleteImage(fileId).catch(e=>console.error('ImageKit cleanup required:',fileId,e.message));
  getIO()?.emit('incident:deleted',{id:incident.id});res.json({ok:true});
}catch(e){next(e);}});
router.post('/:id/vote',citizen,async(req,res,next)=>{try{
  if(!validId(req.params.id)||!['yes','no'].includes(req.body.choice))return res.status(400).json({error:'Valid incident and yes/no choice required'});
  const incident=await Incident.findOne({_id:req.params.id,...publicFilter});
  if(!incident)return res.status(404).json({error:'Incident unavailable'});
  if(incident.reporter.toString()===req.user.id)return res.status(403).json({error:'You cannot verify your own report'});
  if(!req.user.locationUpdatedAt||Date.now()-req.user.locationUpdatedAt.getTime()>120000)return res.status(403).json({error:'A recent GPS fix within two minutes is required'});
  const c=req.user.lastLocation?.coordinates;
  if(!c||distanceMeters(c[1],c[0],incident.location.coordinates[1],incident.location.coordinates[0])>1000)return res.status(403).json({error:'You must be within 1 km of the incident'});
  await Vote.findOneAndUpdate({incident:incident._id,user:req.user._id},{$set:{choice:req.body.choice,votedAt:new Date()}},{upsert:true,new:true,setDefaultsOnInsert:true});
  const [yes,no]=await Promise.all([Vote.countDocuments({incident:incident._id,choice:'yes'}),Vote.countDocuments({incident:incident._id,choice:'no'})]);
  const result=votingResult(yes,no);
  incident.yesCount=yes;incident.noCount=no;incident.verification=result.verified?'community_verified':'unverified';await incident.save();
  getIO()?.emit('incident:updated',{id:incident.id});res.json({result,verification:incident.verification,myVote:req.body.choice});
}catch(e){next(e);}});
router.get('/:id/my-vote',citizen,async(req,res,next)=>{try{if(!validId(req.params.id))return res.status(404).json({error:'Not found'});const vote=await Vote.findOne({incident:req.params.id,user:req.user._id});res.json({choice:vote?.choice||null});}catch(e){next(e);}});
export default router;
