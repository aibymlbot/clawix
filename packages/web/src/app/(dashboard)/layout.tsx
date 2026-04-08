'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import anime from 'animejs';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { EASING, DURATION } from '@/lib/anime';

function AnimatedContent({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!ref.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    ref.current.style.opacity = '0';
    ref.current.style.transform = 'translateY(12px)';

    anime({
      targets: ref.current,
      opacity: [0, 1],
      translateY: [12, 0],
      duration: DURATION.normal,
      easing: EASING,
    });
  }, [pathname]);

  return <div ref={ref}>{children}</div>;
}

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider>
      <header className="fixed inset-x-0 top-0 z-50 flex h-14 items-center gap-2 border-b bg-background px-4">
        <SidebarTrigger className="-ml-1" />
      </header>
      <AppSidebar />
      <SidebarInset>
        <div className="flex-1 overflow-auto pt-14">
          <AnimatedContent>{children}</AnimatedContent>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
