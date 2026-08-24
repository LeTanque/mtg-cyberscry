import Image from "next/image";

export function CardArt({ src, name }: { src: string | null; name: string }) {
  if (!src) return <div className="card-placeholder"><span>{name.slice(0, 1)}</span></div>;
  return <Image className="card-art" src={src} alt={name} width={180} height={250} unoptimized/>;
}
