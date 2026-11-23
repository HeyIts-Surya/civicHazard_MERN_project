import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import {Admin} from '../src/models/index.js';
import dns from "node:dns";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

const username=process.env.MAIN_ADMIN_USERNAME;

const password=process.env.MAIN_ADMIN_PASSWORD;

if(!process.env.MONGODB_URI||!username||!password||password.length<14||!/^[a-z0-9._-]{4,60}$/.test(username))
    {
        console.error('Set MONGODB_URI, MAIN_ADMIN_USERNAME (4+ chars) and MAIN_ADMIN_PASSWORD (14+ chars) as environment variables to seed once.');
        process.exit(1);
    }
await mongoose.connect(process.env.MONGODB_URI);
const existing=await Admin.findOne({role:'main'});
if(existing){console.error('Main administrator already exists. Seed refused; use change-password or documented offline recovery procedure.');await mongoose.disconnect();process.exit(1);}
await Admin.create({username,passwordHash:await bcrypt.hash(password,12),role:'main',permissions:[]});
console.log('Main administrator created. Username is immutable. Remove credentials from shell history/env after setup.');await mongoose.disconnect();
