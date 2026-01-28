"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutGrid, ScanSearch } from "lucide-react";

export function Navbar() {
    const pathname = usePathname();

    const navItems = [
        {
            name: "HTML AI Generator",
            href: "/generator",
            icon: LayoutGrid,
            disabled: true,
            badge: "Under Construction",
        },
        {
            name: "AdScraping",
            href: "/scraping",
            icon: ScanSearch,
            disabled: false,
        },
    ];

    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-14 items-center px-4">
                <Link href="/" className="mr-6 flex items-center space-x-2">
                    <span className="font-bold text-lg hidden md:inline-block">
                        Adelia AI
                    </span>
                </Link>
                <nav className="flex items-center space-x-6 text-sm font-medium">
                    {navItems.map((item) => (
                        item.disabled ? (
                            <div
                                key={item.href}
                                className="flex items-center space-x-2 text-muted-foreground/50 cursor-not-allowed"
                            >
                                <item.icon className="h-4 w-4" />
                                <span>{item.name}</span>
                                {item.badge && (
                                    <span className="ml-2 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                                        {item.badge}
                                    </span>
                                )}
                            </div>
                        ) : (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center space-x-2 transition-colors hover:text-foreground/80",
                                    pathname === item.href || pathname?.startsWith(item.href)
                                        ? "text-foreground"
                                        : "text-foreground/60"
                                )}
                            >
                                <item.icon className="h-4 w-4" />
                                <span>{item.name}</span>
                            </Link>
                        )
                    ))}
                </nav>
            </div>
        </header>
    );
}
