'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns'
import { ja } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Pencil, Trash2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { TransactionForm } from '@/components/transactions/TransactionForm'
import type { Transaction, Category } from '@/types'

function formatCurrency(n: number) {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(n)
}

export default function ListPage() {
  const supabase = createClient()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [editTarget, setEditTarget] = useState<Transaction | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  const monthLabel = format(currentDate, 'yyyy年M月', { locale: ja })

  const fetchData = useCallback(async () => {
    const start = format(startOfMonth(currentDate), 'yyyy-MM-dd')
    const end = format(endOfMonth(currentDate), 'yyyy-MM-dd')
    const { data } = await supabase
      .from('transactions')
      .select('*, categories(*)')
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: false })
    setTransactions(data ?? [])
  }, [currentDate])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleDelete(id: string) {
    if (!confirm('削除しますか？')) return
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) {
      toast.error('削除に失敗しました')
    } else {
      toast.success('削除しました')
      fetchData()
    }
  }

  // 日付でグループ化
  const grouped = transactions.reduce<Record<string, Transaction[]>>((acc, tx) => {
    const key = tx.date
    if (!acc[key]) acc[key] = []
    acc[key].push(tx)
    return acc
  }, {})

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-2xl mx-auto">
      {/* 月切り替え */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold">{monthLabel}</h1>
        <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* 取引一覧 */}
      {sortedDates.length === 0 ? (
        <p className="text-center text-slate-400 py-12">この月の記録はありません</p>
      ) : (
        sortedDates.map(date => (
          <div key={date}>
            <p className="text-xs font-semibold text-slate-500 mb-2">
              {format(new Date(date + 'T00:00:00'), 'M月d日（E）', { locale: ja })}
            </p>
            <div className="space-y-1.5">
              {grouped[date].map(tx => {
                const cat = tx.categories as Category | undefined
                return (
                  <div
                    key={tx.id}
                    className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 shadow-sm"
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: cat?.color ?? '#94a3b8' }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{cat?.name ?? '—'}</p>
                      {(tx.memo || tx.source) && (
                        <p className="text-xs text-slate-400 truncate">
                          {[tx.source, tx.memo].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                    <span className={`text-sm font-bold shrink-0 ${tx.type === 'income' ? 'text-emerald-600' : 'text-slate-800'}`}>
                      {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setEditTarget(tx)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-rose-400 hover:text-rose-600"
                        onClick={() => handleDelete(tx.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}

      {/* 編集ダイアログ */}
      <Dialog open={!!editTarget} onOpenChange={open => !open && setEditTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>編集</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <TransactionForm
              editTransaction={editTarget}
              onSuccess={() => { setEditTarget(null); fetchData() }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* 追加 FAB */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogTrigger asChild>
          <Button className="fixed bottom-20 right-4 md:bottom-6 h-14 w-14 rounded-full shadow-lg" size="icon">
            <Plus className="h-6 w-6" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>収支を記録</DialogTitle>
          </DialogHeader>
          <TransactionForm onSuccess={() => { setAddOpen(false); fetchData() }} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
