declare module 'virtual:esigglol-assets' {
  const catalog: { champions: { data?: Record<string, { key: string }> }; version: string; valorant: import('../lib/valorant-assets').ValorantAssetManifest | null }
  export default catalog
}
