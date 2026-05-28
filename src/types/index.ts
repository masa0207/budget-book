export type TransactionType = 'income' | 'expense'

export interface Category {
  id: string
  user_id: string
  name: string
  type: TransactionType
  color: string
  is_default: boolean
  created_at: string
}

export interface Transaction {
  id: string
  user_id: string
  type: TransactionType
  amount: number
  category_id: string | null
  date: string
  memo: string | null
  source: string | null
  created_at: string
  updated_at: string
  categories?: Category
}

export interface Budget {
  id: string
  user_id: string
  category_id: string
  year_month: string
  amount: number
  created_at: string
  updated_at: string
  categories?: Category
}

export interface MonthSummary {
  totalIncome: number
  totalExpense: number
  balance: number
}

export interface CategorySummary {
  category: Category
  total: number
  budget?: number
  remaining?: number
  percentage?: number
}
