'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns'
import { ja } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Category } from '@/types'

function formatCurrency(n: number) {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(n)
}

export default function ChartsPage() {
  const supabase = createClient()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<'monthly' | 'category'>('monthly')
  const [monthlyData, setMonthlyData] = useState<{ month: string; income: number; expense: number }[]>([])
  const [categoryData, setCategoryData] = useState<{ name: string; value: number; color: string }[]>([])

  const monthLabel = format(currentDate, 'yyyy年M月', { locale: ja })

  const fetchMonthly = useCallback(async () => {
    // 過去6ヶ月分
    const months = Array.from({ length: 6 }, (_, i) => subMonths(currentDate, 5 - i))
    const results = await Promise.all(
      months.map(async m => {
        const start = format(startOfMonth(m), 'yyyy-MM-dd')
        const end = format(endOfMonth(m), 'yyyy-MM-dd')
        const { data } = await supabase
          .from('transactions')
          .select('type, amount')
          .gte('date', start)
          .lte('date', end)
        const income = (data ?? []).filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
        const expense = (data ?? []).filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
        return { month: format(m, 'M月', { locale: ja }), income, expense }
      })
    )
    setMonthlyData(results)
  }, [currentDate])

  const fetchCategory = useCallback(async () => {
    const start = format(startOfMonth(currentDate), 'yyyy-MM-dd')
    const end = format(endOfMonth(currentDate), 'yyyy-MM-dd')
    const { data } = await supabase
      .from('transactions')
      .select('amount, categories(*)')
      .eq('type', 'expense')
      .gte('date', start)
      .lte('date', end)

    const map = new Map<string, { name: string; value: number; color: string }>()
    for (const tx of data ?? []) {
      const cat = tx.categories as unknown as Category | undefined
      if (!cat) continue
      const existing = map.get(cat.id)
      if (existing) {
        existing.value += tx.amount
      } else {
        map.set(cat.id, { name: cat.name, value: tx.amount, color: cat.color })
      }
    }
    setCategoryData(Array.from(map.values()).sort((a, b) => b.value - a.value))
  }, [currentDate])

  useEffect(() => {
    fetchMonthly()
    fetchCategory()
  }, [fetchMonthly, fetchCategory])

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto">
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

      <Tabs value={view} onValueChange={v => setView(v as 'monthly' | 'category')}>
        <TabsList className="w-full">
          <TabsTrigger value="monthly" className="flex-1">月別推移（6ヶ月）</TabsTrigger>
          <TabsTrigger value="category" className="flex-1">カテゴリ別</TabsTrigger>
        </TabsList>
      </Tabs>

      {view === 'monthly' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">収入・支出の推移</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 10000).toFixed(0)}万`} />
                <Tooltip formatter={(v: unknown) => formatCurrency(Number(v ?? 0))} />
                <Bar dataKey="income" name="収入" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="支出" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {view === 'category' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">カテゴリ別支出（{monthLabel}）</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryData.length === 0 ? (
              <p className="text-center text-slate-400 py-8">支出データがありません</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      dataKey="value"
                    >
                      {categoryData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: unknown) => formatCurrency(Number(v ?? 0))} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-2">
                  {categoryData.map((d, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                        <span>{d.name}</span>
                      </div>
                      <span className="font-medium">{formatCurrency(d.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
