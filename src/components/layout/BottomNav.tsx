'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, List, PieChart, Target, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/',         icon: Home,     label: 'ホーム' },
  { href: '/list',     icon: List,     label: '一覧' },
  { href: '/charts',   icon: PieChart, label: 'グラフ' },
  { href: '/budget',   icon: Target,   label: '予算' },
  { href: '/import',   icon: Upload,   label: 'インポート' },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 md:hidden">
      <div className="flex h-16 items-center justify-around px-1">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors min-w-[56px]',
                active
                  ? 'text-indigo-600'
                  : 'text-slate-500 hover:text-slate-800'
              )}
            >
              <Icon className={cn('h-5 w-5', active && 'stroke-[2.5]')} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
