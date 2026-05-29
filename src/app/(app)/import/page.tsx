'use client'

import { useState, useRef } from 'react'
import Papa from 'papaparse'
import { format, parse, isValid } from 'date-fns'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { getHouseholdId } from '@/lib/supabase/household'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Upload, CheckCircle2, AlertCircle } from 'lucide-react'
import type { Category } from '@/types'

interface PreviewRow {
  date: string
  amount: number
  type: 'income' | 'expense'
  memo: string
  source: string
  categoryName: string
  valid: boolean
  error?: string
}

// マネーフォワードCSVの列マッピング
// 日付, 内容, 金額（円）, 保有金融機関, 大項目, 中項目, メモ, 振替, ID
function parseMoneyForwardRow(row: Record<string, string>): PreviewRow | null {
  const dateStr = row['日付'] ?? row['date'] ?? ''
  const content = row['内容'] ?? row['content'] ?? ''
  const amountStr = (row['金額（円）'] ?? row['amount'] ?? '0').replace(/,/g, '').replace(/[^\d\-]/g, '')
  const institution = row['保有金融機関'] ?? row['institution'] ?? ''
  const bigCategory = row['大項目'] ?? ''

  const memo = row['メモ'] ?? ''
  const transfer = row['振替'] ?? ''

  if (transfer === '1' || transfer === 'true') return null // 振替は除外

  const amount = parseInt(amountStr)
  if (isNaN(amount) || amount === 0) return null

  // 日付パース
  let date: string
  try {
    const parsed = parse(dateStr, 'yyyy/MM/dd', new Date())
    if (!isValid(parsed)) throw new Error()
    date = format(parsed, 'yyyy-MM-dd')
  } catch {
    return {
      date: dateStr, amount: Math.abs(amount), type: 'expense',
      memo: content, source: institution,
      categoryName: bigCategory || 'その他',
      valid: false, error: '日付フォーマット不正',
    }
  }

  const type = amount < 0 ? 'expense' : 'income'
  const categoryName = bigCategory || (type === 'expense' ? 'その他' : 'その他収入')

  return {
    date,
    amount: Math.abs(amount),
    type,
    memo: [content, memo].filter(Boolean).join(' '),
    source: institution,
    categoryName,
    valid: true,
  }
}

export default function ImportPage() {
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [importing, setImporting] = useState(false)
  const [fileName, setFileName] = useState('')

  function parseRows(data: Record<string, string>[]) {
    return data.map(parseMoneyForwardRow).filter((r): r is PreviewRow => r !== null)
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setPreview([])

    // UTF-8で試し、有効行がなければShift-JISで再試行
    Papa.parse(file, {
      header: true,
      encoding: 'UTF-8',
      skipEmptyLines: true,
      complete: (result) => {
        const rows = parseRows(result.data as Record<string, string>[])
        if (rows.length > 0) {
          setPreview(rows)
        } else {
          Papa.parse(file, {
            header: true,
            encoding: 'Shift_JIS',
            skipEmptyLines: true,
            complete: (result2) => {
              setPreview(parseRows(result2.data as Record<string, string>[]))
            },
          })
        }
      },
    })
  }

  async function handleImport() {
    const validRows = preview.filter(r => r.valid)
    if (validRows.length === 0) {
      toast.error('インポートできる有効なデータがありません')
      return
    }

    setImporting(true)
    const [{ data: { user } }, householdId] = await Promise.all([
      supabase.auth.getUser(),
      getHouseholdId(),
    ])
    if (!user || !householdId) return

    // カテゴリ一覧取得
    const { data: cats } = await supabase.from('categories').select('*')
    const catMap = new Map((cats ?? []).map(c => [`${c.type}:${c.name}`, c as Category]))

    let success = 0
    let failed = 0

    const inserts = []
    for (const row of validRows) {
      const key = `${row.type}:${row.categoryName}`
      let cat = catMap.get(key)

      if (!cat) {
        // 新しいカテゴリを作成
        const { data: newCat } = await supabase
          .from('categories')
          .insert({ user_id: user.id, household_id: householdId, name: row.categoryName, type: row.type, color: '#94a3b8' })
          .select()
          .single()
        if (newCat) {
          cat = newCat as Category
          catMap.set(key, cat)
        }
      }

      inserts.push({
        user_id: user.id,
        household_id: householdId,
        type: row.type,
        amount: row.amount,
        category_id: cat?.id ?? null,
        date: row.date,
        memo: row.memo || null,
        source: row.source || null,
      })
    }

    // バッチインサート（100件ずつ）
    for (let i = 0; i < inserts.length; i += 100) {
      const { error } = await supabase.from('transactions').insert(inserts.slice(i, i + 100))
      if (error) {
        failed += Math.min(100, inserts.length - i)
      } else {
        success += Math.min(100, inserts.length - i)
      }
    }

    setImporting(false)
    if (failed === 0) {
      toast.success(`${success}件をインポートしました`)
      setPreview([])
      setFileName('')
    } else {
      toast.error(`${success}件成功、${failed}件失敗`)
    }
  }

  const validCount = preview.filter(r => r.valid).length
  const invalidCount = preview.filter(r => !r.valid).length

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto">
      <h1 className="text-lg font-bold">CSVインポート</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">マネーフォワードCSV</CardTitle>
          <CardDescription className="text-xs">
            マネーフォワード MEの「家計簿」→「収入・支出明細」からダウンロードしたCSVをアップロードしてください
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-300 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-8 w-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm text-slate-500">
              {fileName ? '' : 'クリックしてCSVファイルを選択'}
            </p>
            {fileName && <p className="text-xs text-indigo-600 mt-1 break-all">{fileName}</p>}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFile}
          />
        </CardContent>
      </Card>

      {preview.length > 0 && (
        <>
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              有効 {validCount}件
            </Badge>
            {invalidCount > 0 && (
              <Badge variant="secondary" className="gap-1">
                <AlertCircle className="h-3 w-3 text-rose-500" />
                エラー {invalidCount}件
              </Badge>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-auto max-h-72">
                <table className="w-full text-xs">
                  <thead className="border-b bg-slate-50 sticky top-0">
                    <tr>
                      <th className="text-left p-3 font-medium">日付</th>
                      <th className="text-left p-3 font-medium">カテゴリ</th>
                      <th className="text-right p-3 font-medium">金額</th>
                      <th className="text-left p-3 font-medium">種別</th>
                      <th className="text-left p-3 font-medium">メモ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 50).map((row, i) => (
                      <tr key={i} className={`border-b ${!row.valid ? 'bg-rose-50' : ''}`}>
                        <td className="p-3">{row.date}</td>
                        <td className="p-3">{row.categoryName}</td>
                        <td className="p-3 text-right">{row.amount.toLocaleString()}円</td>
                        <td className="p-3">
                          <Badge variant={row.type === 'income' ? 'secondary' : 'outline'} className="text-[10px]">
                            {row.type === 'income' ? '収入' : '支出'}
                          </Badge>
                        </td>
                        <td className="p-3 max-w-[120px] truncate">{row.memo || row.error || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.length > 50 && (
                  <p className="text-center text-xs text-slate-400 py-2">... 他 {preview.length - 50} 件</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Button
            onClick={handleImport}
            disabled={importing || validCount === 0}
            className="w-full"
          >
            {importing ? 'インポート中...' : `${validCount}件をインポート`}
          </Button>
        </>
      )}
    </div>
  )
}
