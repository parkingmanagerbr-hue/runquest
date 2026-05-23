/** Logo inline (SVG do V2 simplificado para perf). Reproduz a identidade da marca. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1024 1024" className={className} xmlns="http://www.w3.org/2000/svg" aria-label="RunQuest logo">
      <defs>
        <linearGradient id="lm-bg" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#0A0828" />
          <stop offset="60%" stopColor="#2E1B7C" />
          <stop offset="100%" stopColor="#0A0828" />
        </linearGradient>
        <linearGradient id="lm-holo" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00F0FF" />
          <stop offset="50%" stopColor="#A8FF3E" />
          <stop offset="100%" stopColor="#FF7A1A" />
        </linearGradient>
        <linearGradient id="lm-runner" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#A8FF3E" />
        </linearGradient>
        <linearGradient id="lm-plasma" x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="#FF7A1A" stopOpacity="0" />
          <stop offset="50%" stopColor="#FFE15A" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#A8FF3E" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="1024" height="1024" rx="232" fill="url(#lm-bg)" />
      <polygon
        points="512,140 800,308 800,652 512,820 224,652 224,308"
        fill="rgba(15,8,52,0.4)" stroke="url(#lm-holo)" strokeWidth="10" strokeLinejoin="round"
      />
      <path d="M 250,560 Q 420,510 600,470 T 820,420"
            stroke="url(#lm-plasma)" strokeWidth="48" strokeLinecap="round" fill="none" opacity="0.85" />
      <g fill="url(#lm-runner)">
        <ellipse cx="476" cy="296" rx="40" ry="44" />
        <path d="M 458,338 C 455,355 470,372 488,378 L 580,418 C 612,433 630,468 622,498 L 596,548 C 588,564 568,572 552,564 L 466,520 C 446,510 432,490 438,468 L 452,398 C 454,378 452,360 458,338 Z" />
        <path d="M 596,418 C 624,400 660,378 696,348 C 712,334 728,316 738,296 C 744,284 750,280 760,290 C 768,298 766,308 758,322 C 738,358 712,392 682,420 C 660,440 632,460 608,470 Z" />
        <path d="M 478,396 C 458,408 432,422 408,442 C 388,458 372,478 364,498 C 360,508 350,510 342,502 C 334,494 338,484 348,470 C 366,442 392,418 420,402 C 442,388 462,380 478,378 Z" />
        <path d="M 552,564 C 562,588 574,618 580,648 C 584,668 582,690 572,706 C 564,720 548,724 538,716 C 528,708 526,692 530,676 C 534,650 528,624 518,602 C 510,586 510,572 518,562 Z" />
        <path d="M 468,508 C 448,548 420,592 392,624 C 372,648 348,664 326,668 C 312,670 304,660 308,648 C 312,636 326,628 342,620 C 372,604 396,572 414,540 C 428,516 442,498 458,488 Z" />
      </g>
      <g fill="#A8FF3E" stroke="#FFFFFF" strokeWidth="3" strokeLinejoin="round">
        <polygon points="760,260 808,212 856,260 832,272 808,248 784,272" />
        <rect x="794" y="260" width="28" height="38" rx="6" />
      </g>
    </svg>
  );
}
