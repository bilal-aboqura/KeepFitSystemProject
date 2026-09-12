import Image from "next/image";

export default function Loading() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#050505] px-6">
      <Image
        src="/keepfit-logo.png"
        alt="KeepFit Supplement"
        width={160}
        height={54}
        className="h-auto w-32 object-contain sm:w-40"
        priority
      />
    </div>
  );
}
