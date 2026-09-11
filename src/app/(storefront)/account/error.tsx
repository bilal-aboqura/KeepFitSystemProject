"use client";
import { useLang } from "@/components/language/provider";
export default function AccountError({reset}:{reset:()=>void}){const {t}=useLang();return <div role="alert" className="p-6"><p>{t.account.error}</p><button className="btn btn-secondary mt-4" onClick={reset}>{t.account.retry}</button></div>;}
