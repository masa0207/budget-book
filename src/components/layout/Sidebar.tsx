'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, List, PieChart, Target, Upload, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

const navItems = [
  { href: '/',         icon: Home,     label: 'ダッシュボード' },
  { href: '/list',     icon: List,     label: '収支一覧' },
  { href: '/charts',   icon: PieChart, label: 'グラフ' },
  { href: '/budget',   icon: Target,   label: '予算管理' },
  { href: '/import',   icon: Upload,   label: 'CSVインポート' },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="hidden md:flex flex-col w-56 min-h-screen border-r bg-white px-3 py-6">
      <div className="flex items-center gap-2 px-3 mb-8">
        <span className="text-2xl">💰</span>
        <span className="font-bold text-lg">家計簿</span>
      </div>
      <nav className="flex-1 space-y-1">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>
      <Button
        variant="ghost"
        onClick={handleSignOut}
        className="justify-start gap-3 text-slate-500 hover:text-slate-900"
      >
        <LogOut className="h-4 w-4" />
        ログアウト
      </Button>
    </aside>
  )
}
