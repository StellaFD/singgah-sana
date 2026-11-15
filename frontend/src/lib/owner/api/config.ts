export function resolveAssetUrl(path:string|null|undefined):string|null {
 if(!path)return null;
 if(path.startsWith('/uploads/')) return path;
 try {const url=new URL(path);return url.protocol==='https:'?path:null;}catch{return null;}
}
