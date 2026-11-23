import {Audit} from '../models/index.js';
export async function audit(req,action,subjectType,subjectId,details={}){
  try{await Audit.create({actorType:req.admin?'admin':'citizen',actorId:req.admin?req.admin._id:req.user?._id,action,subjectType,subjectId,details});}catch(err){console.error('Audit log failed:',err.message);}
}
