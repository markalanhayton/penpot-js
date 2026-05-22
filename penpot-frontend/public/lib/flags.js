export function parseFlags(flagString) {
  const flags = {};
  if (!flagString) return flags;
  for (const token of flagString.split(/\s+/).filter(Boolean)) {
    if (token.startsWith('enable-')) flags[token.slice(7).replace(/-/g, '_')] = true;
    else if (token.startsWith('disable-')) flags[token.slice(9).replace(/-/g, '_')] = false;
  }
  return flags;
}

export function flagEnabled(flags, name) {
  return !!flags[name.replace(/-/g, '_')];
}

export const DEFAULT_FLAGS = {
  registration: true,
  login_with_password: true,
  login_with_oidc: false,
  login_with_google: false,
  login_with_github: false,
  login_with_gitlab: false,
  export_file_v3: true,
  frontend_svgo: true,
  backend_api_doc: true,
  backend_openapi_doc: true,
  secure_session_cookies: true,
  email_verification: true,
  onboarding: true,
  component_thumbnails: true,
  render_wasm_dpr: true,
  feature_render_wasm: true,
  token_color: true,
  token_shadow: true,
  inspect_styles: true,
  access_tokens: true,
  webhooks: true,
  quotes: true,
};