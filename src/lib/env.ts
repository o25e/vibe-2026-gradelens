export function getRequiredEnv(name: string): string {
  const value = process.env[name]
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export function getOptionalEnv(name: string): string | undefined {
  const value = process.env[name]
  if (!value || !value.trim()) return undefined
  return value
}
