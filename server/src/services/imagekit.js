// ImageKit REST upload; only the backend ever holds the private API key.
export async function uploadImage(file){
  const key=process.env.IMAGEKIT_PRIVATE_KEY;
  if(!key)throw Object.assign(new Error('ImageKit is not configured. Add IMAGEKIT_PRIVATE_KEY to server/.env.'),{status:503});
  const form=new FormData();
  form.append('file',new Blob([file.buffer],{type:file.mimetype}),file.originalname.replace(/[^a-z0-9._-]/gi,'_'));
  form.append('fileName',`hazard-${Date.now()}-${file.originalname.replace(/[^a-z0-9._-]/gi,'_')}`);
  form.append('folder','/civicalert/incidents');
  const response=await fetch('https://upload.imagekit.io/api/v1/files/upload',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(key+':').toString('base64')},body:form,signal:AbortSignal.timeout(25000)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data.url||!data.fileId)throw Object.assign(new Error(data.message||'ImageKit upload failed'),{status:502});
  return {url:data.url,fileId:data.fileId};
}
export async function deleteImage(fileId){
  if(!fileId||!process.env.IMAGEKIT_PRIVATE_KEY)return;
  const response=await fetch('https://api.imagekit.io/v1/files/'+encodeURIComponent(fileId),{method:'DELETE',headers:{Authorization:'Basic '+Buffer.from(process.env.IMAGEKIT_PRIVATE_KEY+':').toString('base64')},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error('ImageKit delete failed: '+response.status);
}
