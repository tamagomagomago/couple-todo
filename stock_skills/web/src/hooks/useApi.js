import { useState, useEffect, useCallback } from 'react'

const LS_KEY = 'stock_api_base'
const DEFAULT_BASE = import.meta.env.VITE_API_BASE || '/api'

/** localStorage から API ベースURLを取得する */
export function getApiBase() {
  return localStorage.getItem(LS_KEY) || DEFAULT_BASE
}

/** localStorage に API ベースURLを保存する */
export function setApiBase(url) {
  const trimmed = url.trim().replace(/\/+$/, '') // 末尾スラッシュ除去
  localStorage.setItem(LS_KEY, trimmed)
}

/** localStorage の設定をリセットする */
export function resetApiBase() {
  localStorage.removeItem(LS_KEY)
}

export function useApi(path, options = {}) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const fetchData = useCallback(async () => {
    if (!path) return
    setLoading(true)
    setError(null)
    try {
      const base = getApiBase()
      const res = await fetch(`${base}${path}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `HTTP ${res.status}`)
      }
      const json = await res.json()
      setData(json)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [path])

  useEffect(() => { fetchData() }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}

export async function apiPost(path, body = {}) {
  const base = getApiBase()
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function apiDelete(path) {
  const base = getApiBase()
  const res = await fetch(`${base}${path}`, { method: 'DELETE' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function apiGet(path) {
  const base = getApiBase()
  const res = await fetch(`${base}${path}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}
