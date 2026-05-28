'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns'
import { ja } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { TransactionForm } from '@/components/transactions/TransactionForm'
import type { Transaction, CategorySummary, Category } from '@/types'

function formatCurrency(n: number) {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(n)
}

export default function DashboardPage() {
  const supabase = createClient()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categorySummaries, setCategorySummaries] = useState<CategorySummary[]>([])
  const [open, setOpen] = useState(false)

  const yearMonth = format(currentDate, 'yyyy-MM')
  const monthLabel = format(currentDate, 'yyyy年M月', { locale: ja })

  const fetchData = useCallback(async () => {
    const start = format(startOfMonth(currentDate), 'yyyy-MM-dd')
    const end = format(endOfMonth(currentDate), 'yyyy-MM-dd')

    const [{ data: txs }, { data: budgets }, { data: cats }] = await Promise.all([
      supabase
        .from('transactions')
        .select('*, categories(*)')
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: false }),
      supabase
        .from('budgets')
        .select('*, categories(*)')
        .eq('year_month', yearMonth),
      supabase
        .from('categories')
        .select('*')
        .eq('type', 'expense'),
    ])

    setTransactions(txs ?? [])

    const expenses = (txs ?? []).filter(t => t.type === 'expense')
    const summaryMap = new Map<string, { category: Category; total: number }>()

    for (const tx of expenses) {
      if (!tx.category_id || !tx.categories) continue
      const existing = summaryMap.get(tx.category_id)
      if (existing) {
        existing.total += tx.amount
      } else {
        summaryMap.set(tx.category_id, { category: tx.categories as Category, total: tx.amount })
      }
    }

    const budgetMap = new Map((budgets ?? []).map(b => [b.category_id, b.amount]))

    const summaries: CategorySummary[] = Array.from(summaryMap.values()).map(({ category, total }) => {
      const budget = budgetMap.get(category.id)
      return {
        category,
        total,
        budget,
        remaining: budget != null ? budget - total : undefined,
        percentage: budget ? Math.round((total / budget) * 100) : undefined,
      }
    }).sort((a, b) => b.total - a.total)

    setCategorySummaries(summaries)
  }, [currentDate])

  useEffect(() => { fetchData() }, [fetchData])

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const balance = totalIncome - totalExpense

  const recentTransactions = transactions.slice(0, 5)

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto">
      {/* 月切り替えヘッダー */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold">{monthLabel}</h1>
        <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <TrendingUp className="h-4 w-4 text-emerald-500 mx-auto mb-1" />
            <p className="text-[10px] text-slate-500 mb-0.5">収入</p>
            <p className="text-sm font-bold text-emerald-600">{formatCurrency(totalIncome)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <TrendingDown className="h-4 w-4 text-rose-500 mx-auto mb-1" />
            <p className="text-[10px] text-slate-500 mb-0.5">支出</p>
            <p className="text-sm font-bold text-rose-600">{formatCurrency(totalExpense)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Wallet className="h-4 w-4 text-indigo-500 mx-auto mb-1" />
            <p className="text-[10px] text-slate-500 mb-0.5">残高</p>
            <p className={`text-sm font-bold ${balance >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
              {formatCurrency(balance)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* カテゴリ別支出 */}
      {categorySummaries.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">カテゴリ別支出</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {categorySummaries.map(({ category, total, budget, remaining, percentage }) => (
              <div key={category.id}>
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: category.color }} />
                    <span className="text-sm">{category.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-medium">{formatCurrency(total)}</span>
                    {budget != null && (
                      <span className={`text-xs ml-2 ${(remaining ?? 0) < 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                        残{formatCurrency(remaining ?? 0)}
                      </span>
                    )}
                  </div>
                </div>
                {budget != null && (
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${(percentage ?? 0) > 100 ? 'bg-rose-500' : 'bg-indigo-400'}`}
                      style={{ width: `${Math.min(percentage ?? 0, 100)}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 直近の取引 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">直近の記録</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {recentTransactions.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">まだ記録がありません</p>
          ) : (
            recentTransactions.map(tx => (
              <div key={tx.id} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  {tx.categories && (
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: (tx.categories as Category).color }} />
                  )}
                  <div>
                    <p className="text-sm">{(tx.categories as Category)?.name ?? 'カテゴリなし'}</p>
                    <p className="text-xs text-slate-400">{tx.date}{tx.memo ? ` · ${tx.memo}` : ''}</p>
                  </div>
                </div>
                <span className={`text-sm font-medium ${tx.type === 'income' ? 'text-emerald-600' : 'text-slate-800'}`}>
                  {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* 記録追加ボタン（FAB） */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            className="fixed bottom-20 right-4 md:bottom-6 h-14 w-14 rounded-full shadow-lg"
            size="icon"
          >
            <Plus className="h-6 w-6" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>収支を記録</DialogTitle>
          </DialogHeader>
          <TransactionForm onSuccess={() => { setOpen(false); fetchData() }} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
