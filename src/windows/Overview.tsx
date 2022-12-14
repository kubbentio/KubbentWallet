import React, { useState, useRef, useMemo } from "react";
import { Platform, Animated, StyleSheet, View, ScrollView, StatusBar, Easing, RefreshControl, NativeSyntheticEvent, NativeScrollEvent, PixelRatio } from "react-native";
import Clipboard from "@react-native-community/clipboard";
import { Icon, Text, Card, CardItem, Spinner as NativeBaseSpinner, Button } from "native-base";
import { DrawerActions, useNavigation } from "@react-navigation/native";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { createBottomTabNavigator, BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { getStatusBarHeight } from "react-native-status-bar-height";
import Long from "long";

import { RootStackParamList } from "../Main";
import { useStoreActions, useStoreState } from "../state/store";
import TransactionCard from "../components/TransactionCard";
import Container from "../components/Container";
import { timeout, toast } from "../utils/index";
import { formatBitcoin, convertBitcoinToFiat } from "../utils/bitcoin-units";
import FooterNav from "../components/FooterNav";
import Drawer from "../components/Drawer";
import * as nativeBaseTheme from "../native-base-theme/variables/commonColor";
import Spinner from "../components/Spinner";
import QrCode from "../components/QrCode";
import { HEADER_MIN_HEIGHT, HEADER_MAX_HEIGHT, PLATFORM } from "../utils/constants";
import { fontFactor, fontFactorNormalized, zoomed } from "../utils/scale";
import useLayoutMode from "../hooks/useLayoutMode";
import CopyAddress from "../components/CopyAddress";
import { StackNavigationProp } from "@react-navigation/stack";
import KubbentHeader from "../components/KubbentHeader";

import { useTranslation } from "react-i18next";
import { namespaces } from "../i18n/i18n.constants";
import { TouchableOpacity } from "react-native-gesture-handler";

const AnimatedIcon = Animated.createAnimatedComponent(Icon);

const theme = nativeBaseTheme.default;
const kubbentTheme = nativeBaseTheme.kubbentTheme;
const NUM_TRANSACTIONS_PER_LOAD = 25;
const LOAD_BOTTOM_PADDING = 475;

export interface IOverviewProps {
  navigation: BottomTabNavigationProp<RootStackParamList, "Overview">;
}
function Overview({ navigation }: IOverviewProps) {
  const { t, i18n } = useTranslation(namespaces.overview);

  const layoutMode = useLayoutMode();
  const rpcReady = useStoreState((store) => store.lightning.rpcReady);
  const balance = useStoreState((store) => store.channel.balance);
  const pendingOpenBalance = useStoreState((store) => store.channel.pendingOpenBalance);
  const bitcoinUnit = useStoreState((store) => store.settings.bitcoinUnit);
  const transactions = useStoreState((store) => store.transaction.transactions);
  const isRecoverMode = useStoreState((store) => store.lightning.isRecoverMode);
  const syncedToChain = useStoreState((store) => store.lightning.syncedToChain);
  const fiatUnit = useStoreState((store) => store.settings.fiatUnit);
  const currentRate = useStoreState((store) => store.fiat.currentRate);
  const preferFiat = useStoreState((store) => store.settings.preferFiat);
  const changePreferFiat  = useStoreActions((store) => store.settings.changePreferFiat);
  const hideExpiredInvoices = useStoreState((store) => store.settings.hideExpiredInvoices);

  const bitcoinAddress = useStoreState((store) => store.onChain.address);
  const onboardingState  = useStoreState((store) => store.onboardingState);

  const scrollYAnimatedValue = useRef(new Animated.Value(0)).current;
  const [refreshing, setRefreshing] = useState(false);

  const [contentExpand, setContentExpand] = useState<number>(1);
  const [expanding, setExpanding] = useState<boolean>(false);

  const getBalance = useStoreActions((store) => store.channel.getBalance);
  const getFiatRate = useStoreActions((store) => store.fiat.getRate);
  const checkOpenTransactions = useStoreActions((store) => store.transaction.checkOpenTransactions);
  const getInfo = useStoreActions((store) => store.lightning.getInfo);

  const headerHeight = scrollYAnimatedValue.interpolate({
    inputRange: [0, (HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT)],
    outputRange: [HEADER_MAX_HEIGHT, HEADER_MIN_HEIGHT],
    extrapolate: "clamp",
  });

  const headerFiatOpacity = scrollYAnimatedValue.interpolate({
    inputRange: [0, (HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT)],
    outputRange: [1, 0],
    extrapolate: "clamp",
    easing: Easing.bezier(0.16, 0.9, 0.3, 1),
  });

  const headerBtcFontSize = scrollYAnimatedValue.interpolate({
    inputRange: [0, (HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT)],
    outputRange: [
      (!preferFiat && bitcoinUnit === "satoshi" ? 32 : 37) * fontFactor,
      (!preferFiat && bitcoinUnit === "satoshi" ? 24 : 27) * fontFactor,
    ],
    extrapolate: "clamp",
  });

  const headerBtcHeight = scrollYAnimatedValue.interpolate({
    inputRange: [0, (HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT)],
    outputRange: [
      (!preferFiat && bitcoinUnit === "satoshi" ? 37 : 40) * 1.3 * Math.min(PixelRatio.getFontScale(), 1.4),
      (!preferFiat && bitcoinUnit === "satoshi" ? 38.5 : 42),
    ],
    extrapolate: "clamp",
  });

  const headerBtcMarginTop = scrollYAnimatedValue.interpolate({
    inputRange: [0, (HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT)],
    outputRange: [6, -1],
    extrapolate: "clamp",
  });

  const iconOpacity = scrollYAnimatedValue.interpolate({
    inputRange: [0, (HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT)],
    outputRange: [1, 0],
    extrapolate: "clamp",
    easing: Easing.bezier(0.16, 0.8, 0.3, 1),
  });

  const refreshControl = PLATFORM === "android"
    ? (
        <RefreshControl
          title="Refreshing"
          progressViewOffset={183 / (zoomed ? 0.85 : 1)}
          refreshing={refreshing}
          colors={[kubbentTheme.light]}
          progressBackgroundColor={kubbentTheme.gray}
          onRefresh={async () => {
            if (!rpcReady) {
              return;
            }
            setRefreshing(true);
            try {
              await Promise.all([
                getBalance(),
                getFiatRate(),
                checkOpenTransactions(),
                getInfo(),
                timeout(1000),
              ]);
            } catch (error:any) {
              toast(error.message, 10, "warning");
            }
            setRefreshing(false);
          }}
        />
      )
    : (<></>);
  const transactionListOnScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    Animated.event(
      [{ nativeEvent: { contentOffset: { y: scrollYAnimatedValue }}}],
      { useNativeDriver: false },
    )(event);

    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = LOAD_BOTTOM_PADDING;
    if (!expanding && (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom)) {
      if ((contentExpand * NUM_TRANSACTIONS_PER_LOAD) < transactions.length) {
        setExpanding(true);
        setTimeout(() => setExpanding(false), 1000);
        setContentExpand(contentExpand + 1);
      }
    }
  };

  const txs = useMemo(() => {
    if (transactions.length > 0) {
      return transactions
        .filter((transaction) => hideExpiredInvoices ? !(transaction.status === "EXPIRED" || transaction.status === "CANCELED") : true)
        .map((transaction, key) => {
          if (key > contentExpand * NUM_TRANSACTIONS_PER_LOAD) {
            return null;
          }
          return (<TransactionCard key={transaction.rHash} transaction={transaction} unit={bitcoinUnit} onPress={(rHash) => navigation.navigate("TransactionDetails", { rHash })} />);
      });
    }
    return (<Text style={{ fontFamily: 'Sora-Regular', textAlign: "center", margin: 16 }}>No transactions yet</Text>);
  }, [transactions, contentExpand, bitcoinUnit, hideExpiredInvoices]);

  const onPressBalanceHeader = async () => {
    await changePreferFiat(!preferFiat);
  }

  const onPressSyncIcon = () => {
    navigation.navigate("SyncInfo");
  };

  const bitcoinBalance = formatBitcoin(balance, bitcoinUnit, false);
  const fiatBalance = convertBitcoinToFiat(balance, currentRate, fiatUnit);

  return (
    <Container style={{ marginTop: PLATFORM === "macos" ? 0.5 : 0 }}>
      <StatusBar
        barStyle="light-content"
        hidden={false}
        backgroundColor="black"
        animated={false}
        translucent={true}
      />
      <View style={style.overview}>
        <ScrollView
          contentContainerStyle={style.transactionList}
          scrollEventThrottle={16}
          refreshControl={refreshControl}
          onScroll={transactionListOnScroll}
          testID="TX_LIST"
        >
          {isRecoverMode && (
            <RecoverInfo />
          )}
          {onboardingState === "SEND_ONCHAIN" &&
            <SendOnChain bitcoinAddress={bitcoinAddress} />
          }
          {onboardingState === "DO_BACKUP" &&
            <DoBackup />
          }
          {pendingOpenBalance.greaterThan(0) && (
            <Card>
              <CardItem>
                <View style={{ flex: 1, marginBottom: 28, flexDirection: "row", alignItems: "center" }}>
                  <Text style={{ fontFamily: 'Sora-ExtraLight', flexShrink: 1, width: "100%", marginRight: 5 }}>
                    A new channel is in the process of being opened...
                  </Text>
                  <Button small onPress={() => navigation.navigate("LightningInfo" as never)}>
                    <Text style={{fontFamily: 'Sora-Regular', color: 'black'}}>View</Text>
                  </Button>
                </View>
              </CardItem>
            </Card>
          )}
          <View style={{marginBottom: 26, flexDirection: "row", alignContent: 'center', alignItems: 'center', justifyContent: 'space-between'}}>
            <View style={{alignContent: 'center', alignItems: 'center', justifyContent: 'center'}}>
              <TouchableOpacity onPress={() => navigation.navigate("Send" as never)} style={{marginBottom: 5, borderRadius: 15, padding: 15, borderWidth: 1, borderColor: 'white'}}>
                <AnimatedIcon style={{color: 'white'}} type="Feather" name="send" />
              </TouchableOpacity>
              <Text style={{fontFamily: 'Sora-Regular'}}>Send</Text>
            </View>
            <View style={{alignContent: 'center', alignItems: 'center', justifyContent: 'center'}}>
              <TouchableOpacity onPress={() => navigation.navigate("Receive" as never)} style={{marginBottom: 5, borderRadius: 15, padding: 15, borderWidth: 1, borderColor: 'white'}}>
                <AnimatedIcon style={{color: 'white'}} type="Feather" name="arrow-down" />
              </TouchableOpacity>
              <Text style={{fontFamily: 'Sora-Regular'}}>Receive</Text>
            </View>
            <View style={{alignContent: 'center', alignItems: 'center', justifyContent: 'center'}}>
              <TouchableOpacity onPress={() => navigation.navigate("LightningInfo" as never)} style={{marginBottom: 5, borderRadius: 15, padding: 15, borderWidth: 1, borderColor: 'white'}}>
                <AnimatedIcon style={{color: 'white'}} type="Feather" name="cloud-lightning" />
              </TouchableOpacity>
              <Text style={{fontFamily: 'Sora-Regular'}}>Channels</Text>
            </View>
            <View style={{alignContent: 'center', alignItems: 'center', justifyContent: 'center'}}>
              <TouchableOpacity onPress={() => navigation.navigate("OnChain")} style={{marginBottom: 5, borderRadius: 15, padding: 15, borderWidth: 1, borderColor: 'white'}}>
                <AnimatedIcon style={{color: 'white'}} type="Feather" name="link" />
              </TouchableOpacity>
              <Text style={{fontFamily: 'Sora-Regular'}}>On-Chain</Text>
            </View>
          </View>
          {txs}
        <Animated.View style={[style.animatedTop, { height: headerHeight }]} pointerEvents="box-none">
            <View style={StyleSheet.absoluteFill}>
              <AnimatedIcon
                style={[style.settingsIcon, {}]} type="Feather" name="settings" onPress={() => navigation.navigate("Settings")}
              />
              {!syncedToChain &&
                <Animated.View style={[style.menuIcon, { opacity: iconOpacity }]}>
                  <Spinner onPress={onPressSyncIcon} />
                </Animated.View>
              }
            </View>

            {/* <Animated.Text
              testID="BIG_BALANCE_HEADER"
              onPress={onPressBalanceHeader}
              style={[headerInfo.btc, {
                fontSize: headerBtcFontSize,
                height: PLATFORM === "web" ? undefined : headerBtcHeight,
                position: "relative",
                paddingHorizontal: 12,

                marginTop: Animated.add(
                  headerBtcMarginTop,
                  16 +
                  iconTopPadding +
                  (Platform.select({
                    android: 3,
                    web: -6,
                    ios: 1
                  }) ?? 0) +
                  16
                  ),
                }]}
                >
                {!preferFiat && bitcoinBalance}
                {preferFiat && fiatBalance}
              </Animated.Text> */}
            <TouchableOpacity onPress={onPressBalanceHeader}>
              {!preferFiat &&
                <View style={{
                  marginTop: 30,
                }}>
                  <Text style={{color: 'white', fontSize: 36, fontFamily: 'Sora-Regular'}}>
                    {bitcoinBalance}
                  </Text>
                  <Text style={{color: 'white', textAlign: 'center', fontSize: 22, fontFamily: 'Sora-ExtraLight'}}>
                    {fiatBalance}
                  </Text>
                </View>
              }
              {preferFiat &&
                <View style={{justifyContent: 'center', marginTop: '15%' }}>
                  <Text style={{fontFamily: 'Sora-Regular', textAlign: 'center', fontSize: 22}}>
                    Nothing for you to see here :)
                  </Text>
                </View>
              }
            </TouchableOpacity>
            
            {/* {pendingOpenBalance.equals(0) &&
              <Animated.Text style={[{ fontFamily: 'Sora-ExtraLight',  opacity: headerFiatOpacity }, headerInfo.fiat]}>
              {!preferFiat && fiatBalance}
              {preferFiat && bitcoinBalance}
              </Animated.Text>
            } */}
            {pendingOpenBalance.greaterThan(0) &&
              <Animated.Text style={[{ fontFamily: 'Sora-ExtraLight', opacity: headerFiatOpacity }, headerInfo.pending]}>
                {!preferFiat && <>({formatBitcoin(pendingOpenBalance, bitcoinUnit)} {t("msg.pending",{ns:namespaces.common})})</>}
                {preferFiat && <>({convertBitcoinToFiat(pendingOpenBalance, currentRate, fiatUnit)} {t("msg.pending",{ns:namespaces.common})})</>}
              </Animated.Text>
            }
        </Animated.View>
            </ScrollView>
      </View>
    </Container>
  );
};

const RecoverInfo = () => {
  const { t, i18n } = useTranslation(namespaces.overview);
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const recoverInfo = useStoreState((store) => store.lightning.recoverInfo);

  return (
    <Card>
      <CardItem>
        <View style={{ flex: 1, marginBottom: 36, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{fontFamily: 'Sora-ExtraLight'}}>
            {!recoverInfo.recoveryFinished && <>{t("recoverInfo.msg1")}</>}
            {recoverInfo.recoveryFinished && <>{t("recoverInfo.msg2")}</>}
          </Text>
          <Button small onPress={() => navigation.navigate("SyncInfo")}>
            <Text style={{color: 'black'}}>{t("recoverInfo.more")}</Text>
          </Button>
        </View>
      </CardItem>
    </Card>
  );
};

interface ISendOnChain {
  bitcoinAddress?: string;
}
const SendOnChain = ({ bitcoinAddress }: ISendOnChain) => {
  const { t, i18n } = useTranslation(namespaces.overview);
  const bitcoinUnit = useStoreState((store) => store.settings.bitcoinUnit);
  const fiatUnit = useStoreState((store) => store.settings.fiatUnit);
  const currentRate = useStoreState((store) => store.fiat.currentRate);

  const copyAddress = () => {
    Clipboard.setString(bitcoinAddress!);
    toast(t("sendOnChain.alert"));
  };

  return (
    <Card>
      <CardItem>
        <View style={{marginBottom: 12, flex: 1, alignContent: 'center', alignItems: 'center', flexDirection: "row", justifyContent: "space-between" }}>
          <AnimatedIcon style={{marginRight: 15, color: 'white'}} type="Feather" name="alert-triangle" />
          <Text style={{paddingRight: 15, fontFamily: 'Sora-Regular', fontSize: 14}}>This is a beta wallet, please be aware that something could go wrong.</Text>
        </View>
      </CardItem>
      <CardItem>
        <View style={{ marginBottom: 32, flex: 1, flexDirection: "row", justifyContent: "space-between" }}>
          <View style={{ width: "59%", justifyContent: "center", paddingRight: 4 }}>
            <Text style={{ fontFamily: 'Sora-Regular', fontSize: 15 * fontFactor }}>
                {t("sendOnChain.title")}{"\n\n"}
              <Text style={{ fontFamily: 'Sora-ExtraLight', fontSize: 11 * fontFactor }}>
                {t("sendOnChain.msg1")}{"\n\n"}
                {t("sendOnChain.msg2")}{"\n\n"}
                {t("sendOnChain.msg3")} {formatBitcoin(Long.fromValue(22000), bitcoinUnit)} ({convertBitcoinToFiat(22000, currentRate, fiatUnit)}).
              </Text>
            </Text>
          </View>
          <View style={{ justifyContent: "center" }}>
            {bitcoinAddress
              ?
                <>
                  <QrCode onPress={copyAddress} data={bitcoinAddress?.toUpperCase() ?? " "} size={127} border={10} />
                  <CopyAddress text={bitcoinAddress}  onPress={copyAddress} />
                </>
              : <View style={{ width: 135 + 10 + 9, height: 135 + 10 + 8, justifyContent: "center" }}>
                  <NativeBaseSpinner color={kubbentTheme.light} />
                </View>
            }
          </View>
        </View>
      </CardItem>
    </Card>
  );
};

const DoBackup = () => {
  const { t, i18n } = useTranslation(namespaces.overview);
  const navigation = useNavigation();
  const changeOnboardingState = useStoreActions((store) => store.changeOnboardingState);

  const onPressDismiss = async () => {
    await changeOnboardingState("DONE");
  };

  const onPressBackupWallet = () => {
    navigation.navigate("Welcome" as never, { screen: "Seed"} as never)
  };

  return (
    <Card>
      <CardItem>
        <View style={{ flex: 1, marginBottom: 42 }}>
          <View>
            <Text style={{ fontFamily: 'Sora-ExtraLight', fontSize: 15 * fontFactor }}>{t("doBackup.msg1")}{"\n\n"}{t("doBackup.msg2")}</Text>
          </View>
          <View style={{ flexDirection: "row-reverse", marginTop: 11 }}>
            <Button small style={{marginLeft: 7 }} onPress={onPressBackupWallet}>
              <Text style={{ color: 'black', fontSize: 11 * fontFactorNormalized }}>{t("doBackup.backup")}</Text>
            </Button>
            <Button small onPress={onPressDismiss}>
              <Text style={{ color: 'black', fontSize: 11 * fontFactorNormalized }}>{t("msg.dismiss",{ns:namespaces.common})}</Text>
            </Button>
          </View>
        </View>
      </CardItem>
    </Card>
  );
}

const iconTopPadding = Platform.select({
  android: StatusBar.currentHeight ?? 0,
  ios: getStatusBarHeight(true),
}) ?? 0;

const style = StyleSheet.create({
  overview: {
    flex: 1,
    backgroundColor: kubbentTheme.dark,
  },
  animatedTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: 'black'
  },
  menuIcon: {
    position: "absolute",
    padding: 5,
    paddingRight: 8,
    top: Platform.select({
      native: 8 + iconTopPadding,
      web: 6,
    }) ?? 0,
    left: 8,
    fontSize: 31,
    color: kubbentTheme.light,
  },
  onchainIcon: {
    position: "absolute",
    padding: 6,
    paddingRight: 8,
    top: Platform.select({
      native: 8 + iconTopPadding,
      web: 8,
    }) ?? 0,
    left: 8,
    fontSize: 25,
    color: kubbentTheme.light,
  },
  channelsIcon: {
    position: "absolute",
    padding: 4,
    paddingRight: 8,
    top: Platform.select({
      native: 11 + iconTopPadding,
      web: 10,
    }) ?? 0,
    left: 8 + 24 + 8 + 2,
    fontSize: 28,
    color: kubbentTheme.light,
  },
  settingsIcon: {
    position: "absolute",
    padding: 5,
    top: Platform.select({
      native: 10 + iconTopPadding,
      web: 6,
    }),
    right: 8,
    fontSize: 24,
    color: kubbentTheme.light,
  },
  helpIcon: {
    position: "absolute",
    padding: 5,
    top: Platform.select({
      native: 11 + iconTopPadding,
      web: 7,
    }) ?? 0,
    right: Platform.select({
      native: 8 + 24 + 8 + 8,
      web: 8 + 24 + 8 + 7
    }) ?? 0,
    fontSize: 27,
    color: kubbentTheme.light,
  },
  lightningSyncIcon: {
    position: "absolute",
    padding: 2,
    top: Platform.select({
      native: 12.5 + iconTopPadding,
      web: 7,
    }) ?? 0,
    right: Platform.select({
      native: 8 + 24 + 8 + 8,
      web: 8 + 24 + 8 + 7
    }) ?? 0,
    fontSize: 27,
    color: kubbentTheme.light,
  },
  weblnBrowswerIcon: {
    position: "absolute",
    padding: 5,
    top: Platform.select({
      native: 11 + iconTopPadding,
      web: 7,
    }) ?? 0,
    right: 8 + 24 + 8 + 24 + 7 + 14  + (PLATFORM === "web" ? -1 : 0),
    fontSize: 24,
    color: kubbentTheme.light,
  },
  transactionList: {
    paddingTop: HEADER_MAX_HEIGHT + 10,
    paddingLeft: 7,
    paddingRight: 7,
    paddingBottom: 12,
  },
});

const headerInfo = StyleSheet.create({
  btc: {
    color: kubbentTheme.light,
    marginBottom: Platform.select({
      android: 4,
      ios: -1,
      web: 0,
    }),
    fontFamily: 'Sora-Regular',
    zIndex: 1000,
  },
  fiat: {
    color: kubbentTheme.light,
    fontSize: 18 * fontFactor,
    lineHeight: 21 * fontFactor,
    fontFamily: 'Sora-ExtraLight',
    zIndex: 1000,
  },
  pending: {
    color: "#d6dbdb",
    fontSize: 18 * fontFactor,
    lineHeight: 21 * fontFactor,
  }
});

const OverviewTabs = createBottomTabNavigator();

export function OverviewTabsComponent() {
  const layoutMode = useLayoutMode();

  return (
    <OverviewTabs.Navigator screenOptions={{
      header: () => null,
    }} tabBar={() => layoutMode === "mobile" && PLATFORM !== "macos" ? <></> : <></>}>
      <OverviewTabs.Screen name="Overview" component={Overview} />
    </OverviewTabs.Navigator>
  );
};

const DrawerNav = createDrawerNavigator();

export function DrawerComponent() {
  const layoutMode = useLayoutMode();

  return (
    <DrawerNav.Navigator screenOptions={{
      header: () => <></>,
      drawerStyle: {
        backgroundColor: "transparent",
        borderRightColor: "transparent",
        width: 0,
        borderEndColor: kubbentTheme.dark,
      },
      drawerType: layoutMode === "mobile" ? "front" : "permanent",
      swipeEdgeWidth: 400,
    }} drawerContent={() => <Drawer />}>
      <DrawerNav.Screen name="OverviewTabs" component={OverviewTabsComponent} />
    </DrawerNav.Navigator>
  )
}
export default DrawerComponent;
