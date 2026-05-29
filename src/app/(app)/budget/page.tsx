'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns'
import { ja } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, Minus } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { getHouseholdId } from '@/lib/supabase/household'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import type { Category } from '@/types'

function formatCurrency(n: number) {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(n)
}

interface TxDetail {
  id: string
  amount: number
  date: string
  memo: string | null
  source: string | null
}

interface BudgetRow {
  category: Category
  budget: number
  actual: number
  budgetId?: string
  txDetails: TxDetail[]
}

export default function BudgetPage() {
  const supabase = createClient()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [rows, setRows] = useState<BudgetRow[]>([])
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const yearMonth = format(currentDate, 'yyyy-MM')
  const monthLabel = format(currentDate, 'yyyy年M月', { locale: ja })

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const start = format(startOfMonth(currentDate), 'yyyy-MM-dd')
    const end = format(endOfMonth(currentDate), 'yyyy-MM-dd')
    const prevYearMonth = format(subMonths(currentDate, 1), 'yyyy-MM')

    const [{ data: cats }, { data: budgets }, { data: txs }, { data: prevBudgets }] = await Promise.all([
      supabase.from('categories').select('*').eq('type', 'expense').order('name'),
      supabase.from('budgets').select('*').eq('year_month', yearMonth),
      supabase.from('transactions')
        .select('id, amount, category_id, date, memo, source')
        .eq('type', 'expense')
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: false }),
      supabase.from('budgets').select('*').eq('year_month', prevYearMonth).eq('user_id', user.id),
    ])

    const budgetMap = new Map((budgets ?? []).map(b => [b.category_id, b]))
    const prevBudgetMap = new Map((prevBudgets ?? []).map(b => [b.category_id, b]))

    const actualMap = new Map<string, number>()
    const txDetailMap = new Map<string, TxDetail[]>()
    for (const tx of txs ?? []) {
      if (!tx.category_id) continue
      actualMap.set(tx.category_id, (actualMap.get(tx.category_id) ?? 0) + tx.amount)
      const details = txDetailMap.get(tx.category_id) ?? []
      details.push({ id: tx.id, amount: tx.amount, date: tx.date, memo: tx.memo, source: tx.source })
      txDetailMap.set(tx.category_id, details)
    }

    const newRows: BudgetRow[] = (cats ?? []).map(cat => {
      const b = budgetMap.get(cat.id)
      return {
        category: cat as Category,
        budget: b?.amount ?? 0,
        actual: actualMap.get(cat.id) ?? 0,
        budgetId: b?.id,
        txDetails: txDetailMap.get(cat.id) ?? [],
      }
    })

    setRows(newRows.sort((a, b) => (b.actual ?? 0) - (a.actual ?? 0)))

    const initInputs: Record<string, string> = {}
    for (const row of newRows) {
      const b = budgetMap.get(row.category.id)
      if (b !== undefined) {
        initInputs[row.category.id] = String(b.amount)
      } else {
        const prev = prevBudgetMap.get(row.category.id)
        initInputs[row.category.id] = prev !== undefined ? String(prev.amount) : ''
      }
    }
    setInputs(initInputs)
  }, [currentDate])

  useEffect(() => { fetchData() }, [fetchData])

  async function saveBudget(categoryId: string) {
    const rawVal = inputs[categoryId] ?? ''
    const amount = rawVal === '' ? 0 : parseInt(rawVal)
    if (isNaN(amount) || amount < 0) return

    setSaving(categoryId)
    const [{ data: { user } }, householdId] = await Promise.all([
      supabase.auth.getUser(),
      getHouseholdId(),
    ])
    if (!user || !householdId) return

    const row = rows.find(r => r.category.id === categoryId)
    if (!row) return

    if (row.budgetId) {
      await supabase.from('budgets').update({ amount }).eq('id', row.budgetId)
    } else {
      await supabase.from('budgets').insert({
        user_id: user.id,
        household_id: householdId,
        category_id: categoryId,
        year_month: yearMonth,
        amount,
      })
    }

    toast.success('予算を保存しました')
    setSaving(null)
    fetchData()
  }

  function toggleExpand(categoryId: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(categoryId)) next.delete(categoryId)
      else next.add(categoryId)
      return next
    })
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
          const isExpanded = expanded.has(row.category.id)

          return (
            <Card key={row.category.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: row.category.color }} />
                  <span className="font-medium text-sm flex-1">{row.category.name}</span>
                  {over && <span className="text-xs text-rose-500 font-medium">超過</span>}
                  {row.txDetails.length > 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => toggleExpand(row.category.id)}
                    >
                      {isExpanded
                        ? <Minus className="h-3.5 w-3.5" />
                        : <Plus className="h-3.5 w-3.5" />
                      }
                    </Button>
                  )}
                </div>

                {/* 予算入力 */}
                <div className="flex gap-2">
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder="予算額を入力"
                    min={0}
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

                {/* 明細 */}
                {isExpanded && (
                  <div className="border-t pt-3 space-y-1.5">
                    {row.txDetails.map(tx => (
                      <div key={tx.id} className="flex justify-between items-center text-xs text-slate-600">
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          <span className="text-slate-400 shrink-0">
                            {format(new Date(tx.date + 'T00:00:00'), 'M/d')}
                          </span>
                          <span className="truncate">
                            {[tx.source, tx.memo].filter(Boolean).join(' · ') || '—'}
                          </span>
                        </div>
                        <span className="shrink-0 ml-2 font-medium">{formatCurrency(tx.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
