import Image from 'next/image';

/** Logo oficial — escudo dourado RunQuest. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <Image
      src="/icon-512.png"
      alt="RunQuest"
      width={512}
      height={512}
      className={className}
      priority
    />
  );
}
