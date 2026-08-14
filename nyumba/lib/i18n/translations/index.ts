export type Lang = 'sw' | 'en'

import T_common from './common'
import T_auth from './auth'
import T_tenant from './tenant'
import T_admin from './admin'
import T_dalali from './dalali'
// Phase 2 — filled by parallel agents
import T_adminContent from './admin_content'
import T_dalaliPages from './dalali_pages'
import T_property from './property'
import T_fundiPages from './fundi_pages'
import T_advert from './advert'
import T_client from './client'

const T = {
  ...T_common,
  ...T_auth,
  ...T_tenant,
  ...T_admin,
  ...T_dalali,
  ...T_adminContent,
  ...T_dalaliPages,
  ...T_property,
  ...T_fundiPages,
  ...T_advert,
  ...T_client,
} as const

export type TKey = keyof typeof T
export default T
