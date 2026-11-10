import type { ExpoConfig, ConfigContext } from 'expo/config';
export default ({config}:ConfigContext):ExpoConfig=>{
  const production=process.env.EAS_BUILD_PROFILE==='production';
  const browserDemo=process.env.EXPO_PUBLIC_BROWSER_DEMO==='true';
  if(production&&browserDemo)throw new Error('The browser demo cannot be included in a production store build.');
  const apiUrl=process.env.EXPO_PUBLIC_API_URL||'';
  if(production&&(!apiUrl.startsWith('https://')||/localhost|127\.0\.0\.1/.test(apiUrl)))throw new Error('Set EXPO_PUBLIC_API_URL to your production HTTPS API before building a store release.');
  return {...config,name:'Evpower',slug:'evpower',version:'1.0.0',orientation:'portrait',scheme:'evpower',userInterfaceStyle:'light',
    icon:'./assets/emblem.png',
    ios:{supportsTablet:true,bundleIdentifier:'et.evpower.app',buildNumber:'1',infoPlist:{ITSAppUsesNonExemptEncryption:false}},
    android:{package:'et.evpower.app',versionCode:1,softwareKeyboardLayoutMode:'resize',permissions:['ACCESS_COARSE_LOCATION','ACCESS_FINE_LOCATION'],blockedPermissions:['ACCESS_BACKGROUND_LOCATION','RECORD_AUDIO','READ_MEDIA_IMAGES','READ_MEDIA_VIDEO']},
    web:{bundler:'metro',favicon:'./assets/emblem.png',name:'Evpower'},
    experiments:{baseUrl:browserDemo?(process.env.EXPO_PUBLIC_WEB_BASE_PATH||'/charge/app-preview'):'/app'},
    plugins:['expo-web-browser',['expo-secure-store',{configureAndroidBackup:true}],['expo-location',{locationWhenInUsePermission:'Use your location to set your charging pickup point and find nearby Evpower stations.'}]],
    extra:{...(process.env.EAS_PROJECT_ID?{eas:{projectId:process.env.EAS_PROJECT_ID}}:{})},
  };
};
