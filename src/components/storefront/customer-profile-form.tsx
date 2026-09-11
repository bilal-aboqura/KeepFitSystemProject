"use client";
import { useRef,useState } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "@/components/language/provider";
import { profileSchema } from "@/lib/customers/validation";
import { safeReturnPath } from "@/lib/customers/return-path";
export function CustomerProfileForm({ initial = {full_name:"",phone:""}, next }: {initial?: {full_name:string|null;phone:string|null};next?:string}) {
  const {t}=useLang(); const router=useRouter(); const busy=useRef(false);
  const [saving,setSaving]=useState(false); const [message,setMessage]=useState(""); const [failed,setFailed]=useState(false);
  const feedback=useRef<HTMLParagraphElement>(null);
  async function submit(e:React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if(busy.current) return;
    const form=new FormData(e.currentTarget);
    const input={full_name:form.get("full_name"),phone:form.get("phone")};
    if(!profileSchema.safeParse(input).success){setFailed(true);setMessage(t.account.invalid);return;}
    busy.current=true;setSaving(true);setMessage("");
    try {
      const r=await fetch("/api/customer/me",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(input)});
      if(!r.ok) {setFailed(true);setMessage(r.status===401?t.account.sessionExpired:t.account.error);return;}
      setFailed(false);setMessage(t.account.saved);
      if(next) router.replace(safeReturnPath(next)); router.refresh();
    } catch {setFailed(true);setMessage(t.account.error);}
    finally{busy.current=false;setSaving(false);requestAnimationFrame(()=>feedback.current?.focus());}
  }
  return <form onSubmit={submit} className="mt-6 grid gap-4">
    <label className="grid gap-2">{t.account.name}<input required name="full_name" autoComplete="name" minLength={2} maxLength={120} defaultValue={initial.full_name??""} className="input min-h-11"/></label>
    <label className="grid gap-2">{t.account.phone}<input required name="phone" type="tel" autoComplete="tel" dir="ltr" defaultValue={initial.phone??""} className="input min-h-11"/></label>
    {message&&<p ref={feedback} tabIndex={-1} role={failed?"alert":"status"}>{message}</p>}
    <button disabled={saving} aria-busy={saving} className="btn btn-primary min-h-11">{saving?t.account.saving:t.account.save}</button>
  </form>;
}
