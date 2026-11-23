import mongoose from 'mongoose';
const { Schema, model } = mongoose;
const geoPoint = () => ({type: {type: String, enum:['Point'], default:'Point'}, coordinates:{type:[Number], required:true}});
const userSchema = new Schema({
  googleId:{type:String,unique:true,sparse:true}, name:{type:String,required:true,trim:true}, email:{type:String,unique:true,lowercase:true,trim:true,required:true}, avatar:String,
  role:{type:String,enum:['citizen'],default:'citizen'}, suspended:{type:Boolean,default:false},
  lastLocation:{type:new Schema({type:{type:String,enum:['Point'],required:true},coordinates:{type:[Number],required:true}},{_id:false}),default:undefined}, locationUpdatedAt:Date,
  preferences:{inApp:{type:Boolean,default:true},email:{type:Boolean,default:true},telegram:{type:Boolean,default:false},push:{type:Boolean,default:false}},
  telegramChatId:String, telegramLinkHash:String, telegramLinkExpires:Date, pushSubscriptions:[Schema.Types.Mixed]
},{timestamps:true});
userSchema.index({lastLocation:'2dsphere'});
export const User = model('User',userSchema);

const incidentSchema = new Schema({
  reporter:{type:Schema.Types.ObjectId,ref:'User',required:true,index:true}, description:{type:String,required:true,maxlength:3000},
  image:{url:String,fileId:String},
  location:{...geoPoint(),coordinates:{type:[Number],required:true}},
  category:{type:String,default:'other'}, severity:{type:String,enum:['low','moderate','high','critical','unknown'],default:'unknown'},
  ai:{state:{type:String,enum:['pending','assessed','warning'],default:'pending'},warning:String,summary:String,model:String,assessedAt:Date},
  visibility:{type:String,enum:['public','hidden'],default:'public'}, verification:{type:String,enum:['unverified','community_verified'],default:'unverified'},
  yesCount:{type:Number,default:0},noCount:{type:Number,default:0},possibleDuplicates:[{type:Schema.Types.ObjectId,ref:'Incident'}],
  deletedAt:Date, deletedBy:{type:Schema.Types.ObjectId,ref:'User'}
},{timestamps:true});
incidentSchema.index({location:'2dsphere'});
incidentSchema.index({visibility:1,deletedAt:1,createdAt:-1});
export const Incident = model('Incident',incidentSchema);

const voteSchema = new Schema({incident:{type:Schema.Types.ObjectId,ref:'Incident',required:true},user:{type:Schema.Types.ObjectId,ref:'User',required:true},choice:{type:String,enum:['yes','no'],required:true},votedAt:{type:Date,default:Date.now}},{timestamps:true});
voteSchema.index({incident:1,user:1},{unique:true});
export const Vote=model('Vote',voteSchema);
const notificationSchema=new Schema({recipient:{type:Schema.Types.ObjectId,ref:'User',index:true,required:true},incident:{type:Schema.Types.ObjectId,ref:'Incident'},title:String,message:String,read:{type:Boolean,default:false},kind:{type:String,default:'nearby'}},{timestamps:true});
export const Notification=model('Notification',notificationSchema);
const adminSchema=new Schema({username:{type:String,unique:true,required:true,lowercase:true,trim:true},passwordHash:{type:String,required:true},role:{type:String,enum:['main','sub'],required:true},disabled:{type:Boolean,default:false},mustChangePassword:{type:Boolean,default:false},permissions:{type:[String],default:[]}},{timestamps:true});
export const Admin=model('Admin',adminSchema);
const contactSchema=new Schema({department:{type:String,required:true,trim:true},email:{type:String,required:true,lowercase:true,trim:true},district:{type:String,required:true,trim:true},state:{type:String,required:true,trim:true},categories:[String],active:{type:Boolean,default:true},verifiedContact:{type:Boolean,default:false}},{timestamps:true});
export const AuthorityContact=model('AuthorityContact',contactSchema);
const dispatchSchema=new Schema({incident:{type:Schema.Types.ObjectId,ref:'Incident',required:true},contact:{type:Schema.Types.ObjectId,ref:'AuthorityContact',required:true},byAdmin:{type:Schema.Types.ObjectId,ref:'Admin',required:true},subject:String,body:String,sentAt:Date,messageId:String},{timestamps:true});
export const AuthorityDispatch=model('AuthorityDispatch',dispatchSchema);
const auditSchema=new Schema({actorType:String,actorId:Schema.Types.ObjectId,action:String,subjectType:String,subjectId:Schema.Types.ObjectId,details:{type:Schema.Types.Mixed,default:{}}},{timestamps:true});
export const Audit=model('Audit',auditSchema);
