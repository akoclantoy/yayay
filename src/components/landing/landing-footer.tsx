import Link from "next/link";
import { Recycle } from "lucide-react";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";

export function LandingFooter() {
  return (
    <footer className="border-t border-border bg-white/50 dark:bg-black/20 backdrop-blur-sm">
      <div className="container mx-auto max-w-6xl px-4 py-12">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
          <div className="sm:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                <Recycle className="h-5 w-5 text-primary" />
              </div>
              <span className="font-bold">{APP_NAME}</span>
            </Link>
            <p className="text-sm text-muted-foreground max-w-sm">{APP_TAGLINE}</p>
          </div>
          <div>
            <h4 className="font-semibold mb-3 text-sm">Platform</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#features" className="hover:text-foreground">Features</a></li>
              <li><a href="#how-it-works" className="hover:text-foreground">How it works</a></li>
              <li><Link href="/login" className="hover:text-foreground">Sign in</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3 text-sm">Get started</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/register" className="hover:text-foreground">Create account</Link></li>
              <li><Link href="/login" className="hover:text-foreground">Resident portal</Link></li>
            </ul>
          </div>
        </div>
        <div className="pt-8 border-t border-border text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} {APP_NAME}. Built for sustainable communities.
        </div>
      </div>
    </footer>
  );
}
