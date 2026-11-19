export type ProfileNames = {
  display_name: string;
  name_zh?: string | null;
  name_en?: string | null;
};

export function profileName(profile: ProfileNames, language: 'en' | 'zh') {
  const preferred = language === 'zh' ? profile.name_zh : profile.name_en;
  const other = language === 'zh' ? profile.name_en : profile.name_zh;
  return preferred || other || profile.display_name;
}
