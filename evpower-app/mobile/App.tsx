import React,{useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,AppState,Image,Linking,Platform,Pressable,StyleSheet,Text,View} from 'react-native';
import {SafeAreaProvider,SafeAreaView,useSafeAreaInsets} from 'react-native-safe-area-context';
import {StatusBar} from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import {api} from './src/api';
import type {AppConfig,ScreenName,ScreenProps,Session,User} from './src/types';
import {colors} from './src/theme';
import HomeScreen from './src/screens/HomeScreen';
import StationsScreen from './src/screens/StationsScreen';
import BookingScreen from './src/screens/BookingScreen';
import ActivityScreen from './src/screens/ActivityScreen';
import AccountScreen from './src/screens/AccountScreen';
import WalletScreen from './src/screens/WalletScreen';
import AuthScreen from './src/screens/AuthScreen';

type IconName=React.ComponentProps<typeof Ionicons>['name'];
const tabs:{screen:ScreenName;label:string;icon:IconName}[]=[
  {screen:'home',label:'Home',icon:'grid-outline'},
  {screen:'stations',label:'Stations',icon:'location-outline'},
  {screen:'book',label:'Book charge',icon:'flash'},
  {screen:'activity',label:'Activity',icon:'receipt-outline'},
  {screen:'account',label:'Account',icon:'person-outline'},
];

function Shell(){
  const insets=useSafeAreaInsets();
  const [user,setUser]=useState<User|null>(null);
  const [config,setConfig]=useState<AppConfig|null>(null);
  const [screen,setScreen]=useState<ScreenName>('home');
  const [returnTo,setReturnTo]=useState<ScreenName>('home');
  const [accountAction,setAccountAction]=useState<{kind:'reset'|'verify';token:string}|undefined>();
  const [busy,setBusy]=useState(true);
  const [connectionError,setConnectionError]=useState('');
  const [toast,setToast]=useState('');
  const [refreshKey,setRefreshKey]=useState(0);
  const notify=useCallback((message:string)=>setToast(message),[]);
  const navigate=useCallback((next:ScreenName)=>{setScreen(next);setToast('');if(next!=='auth')setAccountAction(undefined);},[]);
  const load=useCallback(async()=>{
    setBusy(true);setConnectionError('');
    try {setConfig(await api.request<AppConfig>('/v1/config'));await api.restore();}
    catch(error){setConnectionError(error instanceof Error?error.message:'Cannot connect to Evpower.');}
    finally{setBusy(false);}
  },[]);
  useEffect(()=>{
    api.onSession=session=>{setUser(session?.user||null);setRefreshKey(key=>key+1);};
    void load();
    const subscription=AppState.addEventListener('change',state=>{if(state==='active')setRefreshKey(key=>key+1);});
    return()=>{subscription.remove();api.onSession=()=>{};};
  },[load]);
  useEffect(()=>{
    const openAction=(url:string|null|undefined)=>{
      if(!url)return;
      try {
        const link=new URL(url);
        const params=new URLSearchParams(link.hash.replace(/^#/,''));
        const kind=params.get('kind')||link.searchParams.get('kind');
        const token=params.get('token')||link.searchParams.get('token');
        if((kind==='reset'||kind==='verify')&&token&&token.length>=20&&token.length<=200){
          setAccountAction({kind,token});setScreen('auth');
          if(Platform.OS==='web'&&typeof window!=='undefined'){
            const clean=new URL(window.location.href);clean.hash='';clean.searchParams.delete('token');clean.searchParams.delete('kind');
            window.history.replaceState(null,'',clean.pathname+clean.search);
          }
        }
      } catch { /* Invalid links leave the normal sign-in flow available. */ }
    };
    void Linking.getInitialURL().then(openAction);
    const subscription=Linking.addEventListener('url',event=>openAction(event.url));
    const webAction=()=>{if(Platform.OS==='web'&&typeof window!=='undefined')openAction(window.location.href);};
    if(Platform.OS==='web'&&typeof window!=='undefined'){
      window.addEventListener('hashchange',webAction);window.addEventListener('popstate',webAction);webAction();
    }
    return()=>{
      subscription.remove();
      if(Platform.OS==='web'&&typeof window!=='undefined'){
        window.removeEventListener('hashchange',webAction);window.removeEventListener('popstate',webAction);
      }
    };
  },[]);
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),6500);return()=>clearTimeout(timer);},[toast]);
  const onRequireAuth=()=>{setReturnTo(screen==='auth'?'home':screen);setScreen('auth');};
  const onAuthenticated=async(session:Session)=>{await api.setSession(session);setAccountAction(undefined);setScreen(returnTo);notify('Welcome to Evpower.');};
  const onLogout=async()=>{try{await api.logout();}catch{}finally{await api.clear();setScreen('home');notify('You are signed out.');}};
  const props:ScreenProps={user,api,config,navigate,notify,refreshKey,onRequireAuth};
  const current=()=>{
    if(screen==='auth')return <AuthScreen {...props} onAuthenticated={onAuthenticated} initialAction={accountAction}/>;
    if(screen==='stations')return <StationsScreen {...props}/>;
    if(screen==='book')return <BookingScreen {...props}/>;
    if(screen==='activity')return <ActivityScreen {...props}/>;
    if(screen==='account')return <AccountScreen {...props} onLogout={onLogout} onUserChanged={setUser}/>;
    if(screen==='wallet')return <WalletScreen {...props}/>;
    return <HomeScreen {...props}/>;
  };
  return <SafeAreaView style={styles.safe} edges={['top','left','right']}>
    <StatusBar style="dark"/>
    <View style={styles.brandStrip}/>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Evpower home" onPress={()=>navigate('home')} style={styles.logoLink}>
        <Image source={require('./assets/logo.png')} style={styles.logo} resizeMode="contain" accessibilityLabel="Evpower"/>
      </Pressable>
      <View style={styles.headerActions}>
        {user?<Pressable accessibilityRole="button" accessibilityLabel="Notifications and account" onPress={()=>navigate('account')} style={styles.iconButton}><Ionicons aria-hidden={true} accessible={false} accessibilityElementsHidden={true} importantForAccessibility="no-hide-descendants" name="notifications-outline" size={21} color={colors.navy}/></Pressable>:
          <Pressable accessibilityRole="button" accessibilityLabel="Sign in" onPress={onRequireAuth} style={styles.signIn}><Text style={styles.signInText}>Sign in</Text><Ionicons aria-hidden={true} accessible={false} accessibilityElementsHidden={true} importantForAccessibility="no-hide-descendants" name="arrow-forward" size={16} color={colors.blue}/></Pressable>}
      </View>
    </View>
    {config?.isDemo&&<View style={styles.demo}><Text style={styles.demoText}>Development sandbox · sample locations · no real payments</Text></View>}
    <View style={styles.body}>
      {busy?<View style={styles.center}><ActivityIndicator color={colors.blue} size="large"/><Text style={styles.loading}>Connecting your journey…</Text></View>:
        connectionError?<View style={styles.center}><View style={styles.connectionIcon}><Ionicons aria-hidden={true} accessible={false} accessibilityElementsHidden={true} importantForAccessibility="no-hide-descendants" name="cloud-offline-outline" size={36} color={colors.blue}/></View><Text style={styles.errorTitle}>Let’s reconnect</Text><Text style={styles.errorCopy}>{connectionError}</Text><Pressable accessibilityRole="button" onPress={()=>void load()} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable><Pressable accessibilityRole="link" onPress={()=>void Linking.openURL('tel:8890')} style={styles.help}><Text style={styles.helpText}>Need a charge? Call 8890</Text></Pressable></View>:current()}
    </View>
    {!!toast&&<View style={styles.toast} accessibilityLiveRegion="polite"><Ionicons aria-hidden={true} accessible={false} accessibilityElementsHidden={true} importantForAccessibility="no-hide-descendants" name="information-circle-outline" size={19} color="#fff"/><Text style={styles.toastText}>{toast}</Text><Pressable onPress={()=>setToast('')} accessibilityRole="button" accessibilityLabel="Dismiss message"><Ionicons aria-hidden={true} accessible={false} accessibilityElementsHidden={true} importantForAccessibility="no-hide-descendants" name="close" size={20} color="#fff"/></Pressable></View>}
    <View style={[styles.tabs,{paddingBottom:Math.max(insets.bottom,Platform.OS==='web'?10:5)}]}>
      <View style={styles.tabsInner}>{tabs.map(tab=>{
        const selected=screen===tab.screen||(tab.screen==='account'&&(screen==='wallet'||screen==='auth'));
        return <Pressable key={tab.screen} accessibilityRole="tab" accessibilityState={{selected}} accessibilityLabel={tab.label} onPress={()=>navigate(tab.screen)} style={styles.tab}>
          <View style={[styles.tabIcon,tab.screen==='book'&&styles.bookIcon,selected&&tab.screen!=='book'&&styles.selectedIcon]}><Ionicons aria-hidden={true} accessible={false} accessibilityElementsHidden={true} importantForAccessibility="no-hide-descendants" name={tab.icon} size={tab.screen==='book'?25:22} color={tab.screen==='book'?'#fff':selected?colors.blue:'#8292a6'}/></View>
          <Text style={[styles.tabText,selected&&styles.selectedText]}>{tab.label}</Text>
        </Pressable>;
      })}</View>
    </View>
  </SafeAreaView>;
}

export default function App(){return <SafeAreaProvider><Shell/></SafeAreaProvider>;}
const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.background},brandStrip:{height:3,backgroundColor:colors.cyan},
  header:{height:77,paddingHorizontal:22,flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:'#fff',borderBottomColor:colors.line,borderBottomWidth:1},
  logoLink:{width:218,height:59},logo:{width:'100%',height:'100%'},headerActions:{flexDirection:'row',alignItems:'center'},iconButton:{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'},
  signIn:{minHeight:44,flexDirection:'row',alignItems:'center',gap:5},signInText:{fontSize:13,fontWeight:'700',color:colors.blue},
  demo:{backgroundColor:'#fff3d8',paddingVertical:8,paddingHorizontal:16},demoText:{color:'#75551b',fontSize:11,textAlign:'center'},
  body:{flex:1,width:'100%',maxWidth:1040,alignSelf:'center'},center:{flex:1,alignItems:'center',justifyContent:'center',padding:30},loading:{marginTop:17,color:colors.muted,fontSize:14},
  connectionIcon:{width:80,height:80,borderRadius:25,alignItems:'center',justifyContent:'center',backgroundColor:'#e9f4ff',marginBottom:20},
  errorTitle:{fontSize:27,fontWeight:'800',color:colors.navy},errorCopy:{fontSize:14,color:colors.muted,lineHeight:22,textAlign:'center',maxWidth:380,marginVertical:15},
  retry:{minHeight:48,minWidth:170,backgroundColor:colors.blue,borderRadius:13,alignItems:'center',justifyContent:'center',marginTop:10},retryText:{color:'#fff',fontWeight:'700'},help:{padding:18},helpText:{color:colors.blue,fontSize:13},
  toast:{backgroundColor:colors.navy,marginHorizontal:15,marginBottom:9,padding:14,borderRadius:13,flexDirection:'row',gap:9,alignItems:'center'},toastText:{color:'#fff',fontSize:12,lineHeight:18,flex:1},
  tabs:{backgroundColor:'#fff',borderTopWidth:1,borderTopColor:colors.line,paddingTop:8},tabsInner:{flexDirection:'row',maxWidth:740,width:'100%',alignSelf:'center'},tab:{flex:1,minHeight:62,alignItems:'center',justifyContent:'center',gap:3},
  tabIcon:{width:46,height:32,borderRadius:12,alignItems:'center',justifyContent:'center'},bookIcon:{width:48,height:43,borderRadius:16,backgroundColor:colors.blue,marginTop:-10},selectedIcon:{backgroundColor:'#e9f2ff'},tabText:{fontSize:10,fontWeight:'600',color:'#7d8ba0'},selectedText:{color:colors.blue,fontWeight:'800'},
});
