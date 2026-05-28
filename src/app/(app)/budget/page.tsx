'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns'
import { ja } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import type { Category } from '@/types'

function formatCurrency(n: number) {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(n)
}

interface BudgetRow {
  category: Category
  budget: number
  actual: number
  budgetId?: string
}

export default function BudgetPage() {
  const supabase = createClient()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [rows, setRows] = useState<BudgetRow[]>([])
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)

  const yearMonth = format(currentDate, 'yyyy-MM')
  const monthLabel = format(currentDate, 'yyyy年M月', { locale: ja })

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const start = format(startOfMonth(currentDate), 'yyyy-MM-dd')
    const end = format(endOfMonth(currentDate), 'yyyy-MM-dd')

    const [{ data: cats }, { data: budgets }, { data: txs }] = await Promise.all([
      supabase.from('categories').select('*').eq('type', 'expense').order('name'),
      supabase.from('budgets').select('*').eq('year_month', yearMonth).eq('user_id', user.id),
      supabase.from('transactions').select('amount, category_id').eq('type', 'expense').gte('date', start).lte('date', end),
    ])

    const budgetMap = new Map((budgets ?? []).map(b => [b.category_id, b]))
    const actualMap = new Map<string, number>()
    for (const tx of txs ?? []) {
      if (!tx.category_id) continue
      actualMap.set(tx.category_id, (actualMap.get(tx.category_id) ?? 0) + tx.amount)
    }

    const newRows: BudgetRow[] = (cats ?? []).map(cat => {
      const b = budgetMap.get(cat.id)
      return {
        category: cat as Category,
        budget: b?.amount ?? 0,
        actual: actualMap.get(cat.id) ?? 0,
        budgetId: b?.id,
      }
    })

    setRows(newRows.sort((a, b) => b.actual - a.actual))
    const initInputs: Record<string, string> = {}
    for (const row of newRows) {
      initInputs[row.category.id] = row.budget > 0 ? String(row.budget) : ''
    }
    setInputs(initInputs)
  }, [currentDate])

  useEffect(() => { fetchData() }, [fetchData])

  async function saveBudget(categoryId: string) {
    const amount = parseInt(inputs[categoryId] ?? '0') || 0
    setSaving(categoryId)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const row = rows.find(r => r.category.id === categoryId)
    if (!row) return

    if (row.budgetId) {
      await supabase.from('budgets').update({ amount }).eq('id', row.budgetId)
    } else {
      await supabase.from('budgets').insert({
        user_id: user.id,
        category_id: categoryId,
        year_month: yearMonth,
        amount,
      })
    }

    toast.success('予算を保存しました')
    setSaving(null)
    fetchData()
  }

  const totalBudget = rows.reduce((s, r) => s + r.budget, 0)
  const totalActual = rows.reduce((s, r) => s + r.actual, 0)

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto">
      {/* 月切り替え */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold">{monthLabel}の予算</h1>
        <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* 合計サマリー */}
      {totalBudget > 0 && (
        <Card>
          <CardContent className="p-4 flex justify-between items-center">
            <div>
              <p className="text-xs text-slate-500">合計予算</p>
              <p className="text-lg font-bold">{formatCurrency(totalBudget)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">実績</p>
              <p className="text-lg font-bold text-rose-600">{formatCurrency(totalActual)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">残予算</p>
              <p className={`text-lg font-bold ${totalBudget - totalActual >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                {formatCurrency(totalBudget - totalActual)}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* カテゴリ別予算設定 */}
      <div className="space-y-3">
        {rows.map(row => {
          const remaining = row.budget - row.actual
          const pct = row.budget > 0 ? Math.min(Math.round((row.actual / row.budget) * 100), 100) : 0
          const over = row.budget > 0 && row.actual > row.budget

          return (
            <Card key={row.category.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: row.category.color }} />
                  <span className="font-medium text-sm">{row.category.name}</span>
                  {over && <span className="text-xs text-rose-500 font-medium">超過</span>}
                </div>

                {/* 予算入力 */}
                <div className="flex gap-2">
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder="予算額を入力"
                    value={inputs[row.category.id] ?? ''}
                    onChange={e => setInputs(prev => ({ ...prev, [row.category.id]: e.target.value }))}
                    className="flex-1 h-9"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => saveBudget(row.category.id)}
                    disabled={saving === row.category.id}
                    className="h-9"
                  >
                    保存
                  </Button>
                </div>

                {/* 実績・残 */}
                {row.budget > 0 && (
                  <>
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>実績: {formatCurrency(row.actual)}</span>
                      <span className={over ? 'text-rose-500 font-medium' : ''}>
                        残: {formatCurrency(remaining)}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${over ? 'bg-rose-500' : 'bg-indigo-400'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
