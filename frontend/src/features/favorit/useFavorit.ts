'use client';
import { useState,useCallback,useEffect } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { sessionRequest } from '@/features/auth/sessionClient';
import { useRouter } from 'next/navigation';
import { toggleFavoritApi } from './favoritClient';
export function useFavorit(){
 const auth=useAuth(),router=useRouter();
 const [bookmarkedIds,setIds]=useState<string[]>([]),[toastMessage,setToast]=useState('');
 useEffect(()=>{
  if(!auth.isAuthenticated||auth.user?.role!=='pencari'){setIds([]);return;}
  const controller=new AbortController();
  const load=()=>{void sessionRequest<{data:Array<{kos_id:{_id:string}}>}>('/favorit',{signal:controller.signal}).then(r=>setIds(r.data.filter(item=>item?.kos_id?._id).map(item=>item.kos_id._id))).catch(error=>{if(!controller.signal.aborted)setToast(error.message);});};
  load();window.addEventListener('ss:favorites-changed',load);return()=>{controller.abort();window.removeEventListener('ss:favorites-changed',load);};
 },[auth.isAuthenticated,auth.user?.id,auth.user?.role]);
 const toggleFavorit=useCallback(async(id:string)=>{
  if(!auth.isAuthenticated){router.push('/masuk?next='+encodeURIComponent(window.location.pathname+window.location.search));return;}
  if(auth.user?.role!=='pencari'){setToast('Favorit tersedia untuk akun pencari.');return;}
  const result=await toggleFavoritApi(id);setToast(result.message||'');
 },[auth.isAuthenticated,auth.user?.role,router]);
 const clearToast=useCallback(()=>setToast(''),[]);
 return {bookmarkedIds,toggleFavorit,toastMessage,clearToast};
}
