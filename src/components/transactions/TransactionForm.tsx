'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Category, Transaction, TransactionType } from '@/types'

interface Props {
  onSuccess?: () => void
  editTransaction?: Transaction
}

export function TransactionForm({ onSuccess, editTransaction }: Props) {
  const supabase = createClient()

  const [type, setType] = useState<TransactionType>(editTransaction?.type ?? 'expense')
  const [amount, setAmount] = useState(editTransaction ? String(editTransaction.amount) : '')
  const [categoryId, setCategoryId] = useState(editTransaction?.category_id ?? '')
  const [date, setDate] = useState(editTransaction?.date ?? format(new Date(), 'yyyy-MM-dd'))
  const [memo, setMemo] = useState(editTransaction?.memo ?? '')
  const [source, setSource] = useState(editTransaction?.source ?? '')
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function fetchCategories() {
      const { data } = await supabase
        .from('categories')
        .select('*')
        .eq('type', type)
        .order('name')
      setCategories(data ?? [])
      if (!editTransaction) setCategoryId('')
    }
    fetchCategories()
  }, [type])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || !categoryId || !date) {
      toast.error('金額・カテゴリ・日付は必須です')
      return
    }
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload = {
      user_id: user.id,
      type,
      amount: parseInt(amount.replace(/,/g, '')),
      category_id: categoryId,
      date,
      memo: memo || null,
      source: source || null,
    }

    const { error } = editTransaction
      ? await supabase.from('transactions').update(payload).eq('id', editTransaction.id)
      : await supabase.from('transactions').insert(payload)

    setLoading(false)

    if (error) {
      toast.error('保存に失敗しました')
      return
    }

    toast.success(editTransaction ? '更新しました' : '登録しました')
    if (!editTransaction) {
      setAmount('')
      setMemo('')
      setSource('')
      setCategoryId('')
      setDate(format(new Date(), 'yyyy-MM-dd'))
    }
    onSuccess?.()
  }

  const filteredCategories = categories.filter(c => c.type === type)

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 収入 / 支出 切り替え */}
      <Tabs value={type} onValueChange={v => setType(v as TransactionType)}>
        <TabsList className="w-full">
          <TabsTrigger value="expense" className="flex-1">支出</TabsTrigger>
          <TabsTrigger value="income" className="flex-1">収入</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* 日付 */}
      <div className="space-y-1.5">
        <Label htmlFor="date">日付</Label>
        <Input
          id="date"
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          required
        />
      </div>

      {/* 金額 */}
      <div className="space-y-1.5">
        <Label htmlFor="amount">金額（円）</Label>
        <Input
          id="amount"
          type="number"
          inputMode="numeric"
          placeholder="0"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          min={1}
          required
        />
      </div>

      {/* カテゴリ */}
      <div className="space-y-1.5">
        <Label>カテゴリ</Label>
        <Select value={categoryId} onValueChange={setCategoryId} required>
          <SelectTrigger>
            <SelectValue placeholder="カテゴリを選択" />
          </SelectTrigger>
          <SelectContent>
            {filteredCategories.map(cat => (
              <SelectItem key={cat.id} value={cat.id}>
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                  {cat.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 支払元 / 収入元 */}
      <div className="space-y-1.5">
        <Label htmlFor="source">{type === 'expense' ? '支払元' : '収入元'}</Label>
        <Input
          id="source"
          placeholder={type === 'expense' ? '現金・クレジットカードなど' : '会社名など'}
          value={source}
          onChange={e => setSource(e.target.value)}
        />
      </div>

      {/* メモ */}
      <div className="space-y-1.5">
        <Label htmlFor="memo">メモ</Label>
        <Input
          id="memo"
          placeholder="メモ（任意）"
          value={memo}
          onChange={e => setMemo(e.target.value)}
        />
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? '保存中...' : editTransaction ? '更新する' : '登録する'}
      </Button>
    </form>
  )
}
