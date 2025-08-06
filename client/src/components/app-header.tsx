import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Code, User, Sparkles } from 'lucide-react';

export function AppHeader() {
  return (
    <header className="min-h-[4rem] bg-slate-900/90 backdrop-blur-xl border-b border-purple-500/20 flex items-center justify-between px-6 py-2 shrink-0 relative z-50">
      <Link href="/">
        <div className="flex items-center gap-3 cursor-pointer group">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
            <Code className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col justify-center">
            <h1 className="text-xl font-bold bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent leading-tight">
              Video Editor Pro
            </h1>
            <Badge variant="secondary" className="text-xs bg-purple-500/20 text-purple-300 border-purple-500/30 w-fit">
              <Sparkles className="w-3 h-3 mr-1" />
              AI-Powered
            </Badge>
          </div>
        </div>
      </Link>

      <div className="flex items-center gap-4">
        <Link href="/account">
          <Button 
            variant="outline" 
            size="sm"
            className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:border-purple-500/50"
          >
            <User className="w-4 h-4 mr-2" />
            Account
          </Button>
        </Link>
      </div>
    </header>
  );
}