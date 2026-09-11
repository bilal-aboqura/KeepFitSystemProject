"use client";
import { useRef,useState } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "@/components/language/provider";
import type { CustomerAddress } from "@/lib/customers/types";
import { addressSchema } from "@/lib/customers/validation";
export function CustomerAddressForm({addresses=[]}:{addresses?:CustomerAddress[]}) {
  const {t}=useLang(); const router=useRouter();const busy=useRef(false);
  const [editing,setEditing]=useState<CustomerAddress|null>(null);const [pending,setPending]=useState(false);const [error,setError]=useState("");
  const formRef=useRef<HTMLFormElement>(null);
  async function command(path:string,method:string,body?:unknown) {
    if(busy.current)return false;busy.current=true;setPending(true);setError("");
    try {
      const r=await fetch("/api/customer/addresses"+path,{method,headers:{"content-type":"application/json"},body:body?JSON.stringify(body):undefined});
      if(!r.ok){setError(r.status===401?t.account.sessionExpired:t.account.error);return false;}
      router.refresh();return true;
    }catch{setError(t.account.error);return false;}
    finally{busy.current=false;setPending(false);}
  }
  async function submit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();const f=new FormData(e.currentTarget);
    const parsed=addressSchema.safeParse({...Object.fromEntries(f),is_default:f.get("is_default")==="on"});
    if(!parsed.success){setError(t.account.invalid);return;}
    if(await command(editing?"/"+editing.id:"",editing?"PATCH":"POST",parsed.data)){setEditing(null);formRef.current?.reset();}
  }
  const fields=[["full_name",t.account.recipient],["phone",t.account.phone],["governorate",t.account.governorate],["city",t.account.city],["address",t.account.address]] as const;
  return <div>
    <div className="mt-6 grid gap-4">{addresses.length?addresses.map(a=><article key={a.id} className="glass min-w-0 break-words p-4">
      <h2 className="font-semibold">{a.full_name}{a.is_default?" · "+t.account.default:""}</h2><p className="mt-2">{a.address}, {a.city}, {a.governorate}</p><p dir="ltr">{a.phone}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button disabled={pending} className="btn btn-secondary min-h-11" onClick={()=>{setEditing(a);requestAnimationFrame(()=>{formRef.current?.scrollIntoView({block:"center"});formRef.current?.querySelector("input")?.focus();});}}>{t.account.edit}</button>
        {!a.is_default&&<button disabled={pending} className="btn btn-secondary min-h-11" onClick={()=>void command("/"+a.id+"/default","POST")}>{t.account.makeDefault}</button>}
        <button disabled={pending} className="btn btn-secondary min-h-11" onClick={()=>void command("/"+a.id,"DELETE")}>{t.account.remove}</button>
      </div></article>):<p>{t.account.noAddresses}</p>}</div>
    {error&&<p role="alert" className="mt-4 text-red-700">{error}</p>}
    <form ref={formRef} key={editing?.id??"new"} onSubmit={submit} className="glass mt-6 grid gap-4 p-5 sm:grid-cols-2" aria-busy={pending}>
      <h2 className="text-xl font-semibold sm:col-span-2">{editing?t.account.edit:t.account.addAddress}</h2>
      {fields.map(([name,label])=><label key={name} className="grid gap-2">{label}<input required name={name} defaultValue={editing?.[name]??""} type={name==="phone"?"tel":"text"} dir={name==="phone"?"ltr":undefined} maxLength={name==="address"?500:120} className="input min-h-11" /></label>)}
      <label className="flex min-h-11 items-center gap-2"><input name="is_default" type="checkbox" defaultChecked={editing?.is_default}/>{t.account.makeDefault}</label>
      <button disabled={pending} className="btn btn-primary min-h-11">{pending?t.account.saving:t.account.save}</button>
      {editing&&<button type="button" className="btn btn-secondary min-h-11" onClick={()=>setEditing(null)}>{t.account.cancel}</button>}
    </form></div>;
}
