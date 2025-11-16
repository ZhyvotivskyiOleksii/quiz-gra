'use client';
export function Footer() {
  return (
    <footer className="relative mt-12 w-full shrink-0 border-t border-white/10 bg-background/70 backdrop-blur-sm shadow-[0_-10px_30px_rgba(4,5,12,0.55)]">
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(187,155,255,0.18),_transparent_55%)]" />
      </div>
      <div className="container relative flex max-w-[1440px] flex-col items-center gap-4 px-6 py-6 sm:flex-row sm:px-10">
        <p className="order-2 text-xs text-muted-foreground sm:order-1">
          © 2024 QuizTime. Wszelkie prawa zastrzeżone.
        </p>
        <nav className="order-3 flex gap-4 text-xs sm:order-3 sm:ml-auto sm:gap-6">
          <a href="#" className="text-muted-foreground transition hover:text-white">
            Regulamin
          </a>
          <a href="#" className="text-muted-foreground transition hover:text-white">
            Polityka Prywatności
          </a>
        </nav>
      </div>
    </footer>
  );
}
