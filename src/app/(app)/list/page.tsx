'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns'
import { ja } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Pencil, Trash2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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

  const [filterDateFrom, setFilterDateFrom] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [filterDateTo, setFilterDateTo] = useState(() => format(endOfMonth(new Date()), 'yyyy-MM-dd'))
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterSource, setFilterSource] = useState('all')

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
    setFilterDateFrom(start)
    setFilterDateTo(end)
    setFilterCategory('all')
    setFilterSource('all')
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

  // フィルター用の選択肢（取引データから導出）
  const uniqueCategories = useMemo(() => {
    const map = new Map<string, Category>()
    for (const tx of transactions) {
      const cat = tx.categories as Category | undefined
      if (cat) map.set(cat.id, cat)
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [transactions])

  const uniqueSources = useMemo(() => {
    const set = new Set<string>()
    for (const tx of transactions) {
      if (tx.source) set.add(tx.source)
    }
    return Array.from(set).sort()
  }, [transactions])

  // フィルター適用
  const filtered = useMemo(() => {
    return transactions.filter(tx => {
      if (filterDateFrom && tx.date < filterDateFrom) return false
      if (filterDateTo && tx.date > filterDateTo) return false
      if (filterCategory !== 'all') {
        const cat = tx.categories as Category | undefined
        if (cat?.id !== filterCategory) return false
      }
      if (filterSource !== 'all' && tx.source !== filterSource) return false
      return true
    })
  }, [transactions, filterDateFrom, filterDateTo, filterCategory, filterSource])

  // 合計
  const totalExpense = useMemo(() =>
    filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0), [filtered])
  const totalIncome = useMemo(() =>
    filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0), [filtered])

  // 日付でグループ化
  const grouped = useMemo(() => {
    return filtered.reduce<Record<string, Transaction[]>>((acc, tx) => {
      if (!acc[tx.date]) acc[tx.date] = []
      acc[tx.date].push(tx)
      return acc
    }, {})
  }, [filtered])

  const sortedDates = useMemo(() =>
    Object.keys(grouped).sort((a, b) => b.localeCompare(a)), [grouped])

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

      {/* フィルター */}
      <div className="bg-slate-50 rounded-xl p-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 w-14 shrink-0">日付</span>
          <Input
            type="date"
            value={filterDateFrom}
            onChange={e => setFilterDateFrom(e.target.value)}
            className="h-8 text-xs flex-1 bg-white"
          />
          <span className="text-xs text-slate-400 shrink-0">〜</span>
          <Input
            type="date"
            value={filterDateTo}
            onChange={e => setFilterDateTo(e.target.value)}
            className="h-8 text-xs flex-1 bg-white"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 w-14 shrink-0">カテゴリ</span>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="h-8 text-xs flex-1 bg-white">
              <SelectValue placeholder="すべて" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              {uniqueCategories.map(cat => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 w-14 shrink-0">支払元</span>
          <Select value={filterSource} onValueChange={setFilterSource}>
            <SelectTrigger className="h-8 text-xs flex-1 bg-white">
              <SelectValue placeholder="すべて" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              {uniqueSources.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 合計 */}
      <div className="flex gap-2">
        <div className="flex-1 bg-white rounded-xl px-3 py-2.5 shadow-sm text-center">
          <p className="text-xs text-slate-500">支出</p>
          <p className="text-sm font-bold text-slate-800">{formatCurrency(totalExpense)}</p>
        </div>
        <div className="flex-1 bg-white rounded-xl px-3 py-2.5 shadow-sm text-center">
          <p className="text-xs text-slate-500">収入</p>
          <p className="text-sm font-bold text-emerald-600">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="flex-1 bg-white rounded-xl px-3 py-2.5 shadow-sm text-center">
          <p className="text-xs text-slate-500">件数</p>
          <p className="text-sm font-bold text-slate-800">{filtered.length}件</p>
        </div>
      </div>

      {/* 取引一覧 */}
      {sortedDates.length === 0 ? (
        <p className="text-center text-slate-400 py-12">該当する記録はありません</p>
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
