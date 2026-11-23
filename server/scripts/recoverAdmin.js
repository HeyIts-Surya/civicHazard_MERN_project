// OFFLINE-only recovery for the root admin if the password is lost.
// This requires direct access to the production MongoDB URI AND an explicit one-time approval flag.
// Do not expose this script as an HTTP route or bundle it in a frontend.
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import {Admin} from '../src/models/index.js';
if(process.env.RECOVER_MAIN_ADMIN!=='I_HAVE_VERIFIED_DATABASE_ACCESS'||!process.env.MONGODB_URI||!process.env.NEW_MAIN_ADMIN_PASSWORD||process.env.NEW_MAIN_ADMIN_PASSWORD.length<14){
 console.error('Recovery refused. Use RECOVER_MAIN_ADMIN=I_HAVE_VERIFIED_DATABASE_ACCESS and NEW_MAIN_ADMIN_PASSWORD (14+ chars) in a secure administrative environment.');process.exit(1);
}
await mongoose.connect(process.env.MONGODB_URI);
const main=await Admin.findOne({role:'main'});
if(!main){console.error('No main admin found.');process.exitCode=1;}
else{main.passwordHash=await bcrypt.hash(process.env.NEW_MAIN_ADMIN_PASSWORD,12);await main.save();console.log(`Recovered root credential for immutable username: ${main.username}. Revoke old sessions by rotating JWT_SECRET if compromise is suspected.`);}
await mongoose.disconnect();
