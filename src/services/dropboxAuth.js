import { Dropbox, DropboxAuth } from 'dropbox'
import { Browser } from '@capacitor/browser'

const STORAGE_KEY_APP_KEY = 'dropbox_app_key'
const STORAGE_KEY_APP_SECRET = 'dropbox_app_secret'
const STORAGE_KEY_TOKEN = 'dropbox_access_token'
const STORAGE_KEY_VERIFIER = 'dropbox_code_verifier'
const STORAGE_KEY_FILE_PATH = 'dropbox_file_path'

// Capacitor のカスタムスキームまたは開発用 localhost
const REDIRECT_URI =
  import.meta.env.DEV
    ? window.location.origin
    : 'com.songeducator.app://oauth/callback'

export function saveCredentials(appKey, appSecret) {
  localStorage.setItem(STORAGE_KEY_APP_KEY, appKey)
  localStorage.setItem(STORAGE_KEY_APP_SECRET, appSecret)
}

export function loadCredentials() {
  return {
    appKey: localStorage.getItem(STORAGE_KEY_APP_KEY) ?? '',
    appSecret: localStorage.getItem(STORAGE_KEY_APP_SECRET) ?? '',
  }
}

export function getAccessToken() {
  return localStorage.getItem(STORAGE_KEY_TOKEN)
}

export function isAuthenticated() {
  return !!getAccessToken()
}

export function saveFilePath(path) {
  localStorage.setItem(STORAGE_KEY_FILE_PATH, path)
}

export function loadFilePath() {
  return localStorage.getItem(STORAGE_KEY_FILE_PATH) ?? ''
}

export function clearAuth() {
  localStorage.removeItem(STORAGE_KEY_TOKEN)
  localStorage.removeItem(STORAGE_KEY_VERIFIER)
}

export function getDropboxClient() {
  const token = getAccessToken()
  const { appKey } = loadCredentials()
  if (!token || !appKey) return null
  return new Dropbox({ accessToken: token, clientId: appKey })
}

export async function startAuthFlow() {
  const { appKey } = loadCredentials()
  if (!appKey) throw new Error('App Key が設定されていません')

  const auth = new DropboxAuth({ clientId: appKey })
  const authUrl = await auth.getAuthenticationUrl(
    REDIRECT_URI,
    undefined,
    'code',
    'offline',
    undefined,
    undefined,
    true, // PKCE
  )

  // PKCE code verifier を保存
  localStorage.setItem(STORAGE_KEY_VERIFIER, auth.getCodeVerifier())

  await Browser.open({ url: authUrl.toString() })
}

export async function handleCallback(code) {
  const { appKey } = loadCredentials()
  const verifier = localStorage.getItem(STORAGE_KEY_VERIFIER)
  if (!appKey || !verifier) throw new Error('認証情報が不足しています')

  const auth = new DropboxAuth({ clientId: appKey })
  auth.setCodeVerifier(verifier)

  const response = await auth.getAccessTokenFromCode(REDIRECT_URI, code)
  const token = response.result.access_token

  localStorage.setItem(STORAGE_KEY_TOKEN, token)
  localStorage.removeItem(STORAGE_KEY_VERIFIER)

  return token
}
