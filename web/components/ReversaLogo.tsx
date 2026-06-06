import Image from 'next/image'

export default function ReversaLogo() {
  return (
    <Image
      src="/reversa-logo-white.png"
      alt="Reversa"
      width={96}
      height={28}
      style={{ objectFit: 'contain' }}
      priority
    />
  )
}
