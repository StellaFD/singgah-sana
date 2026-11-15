import { Heart, MessageCircle, ShieldCheck, Bell, ChevronDown, ChevronLeft, Check, CircleCheck, CircleAlert, Info, Mail, User, Lock, SlidersHorizontal, House, Search, X, Clock, Upload, Menu, Flag, Eye, EyeOff, type LucideIcon } from 'lucide-react';
const icons: Record<string,LucideIcon>={heart:Heart,'message-circle':MessageCircle,'shield-check':ShieldCheck,bell:Bell,'chevron-down':ChevronDown,'chevron-left':ChevronLeft,check:Check,'circle-check':CircleCheck,'circle-alert':CircleAlert,info:Info,mail:Mail,user:User,lock:Lock,'sliders-horizontal':SlidersHorizontal,house:House,search:Search,x:X,clock:Clock,upload:Upload,menu:Menu,flag:Flag,eye:Eye,'eye-off':EyeOff};
export type IconName=keyof typeof icons;
export function Icon({name,size=20,className='',fill=false}:{name:IconName;size?:number;className?:string;fill?:boolean}){
 const Glyph=icons[name]||Info;return <Glyph className={'ui-icon '+className} size={size} strokeWidth={2} fill={fill?'currentColor':'none'} aria-hidden="true"/>;
}
