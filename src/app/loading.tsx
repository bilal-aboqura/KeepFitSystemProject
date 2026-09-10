import Image from "next/image";

export default function Loading() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-white px-6">
      <Image
        src="/logo.png"
        alt="Xeemo"
        width={160}
        height={54}
        className="h-auto w-28 object-contain brightness-0 sm:w-36"
        priority
      />
    </div>
  );
}
