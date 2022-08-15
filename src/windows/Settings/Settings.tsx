import React, { useLayoutEffect } from "react";
import { StyleSheet, NativeModules, PermissionsAndroid, Linking, Platform, View, ScrollView } from "react-native";
import Clipboard from "@react-native-community/clipboard";
import DocumentPicker from "react-native-document-picker";
import { readFile } from "react-native-fs";
import Container from "../../components/Container";
import { CheckBox, Body, Icon, Text, Left, List, ListItem, Right } from "native-base";
import DialogAndroid from "react-native-dialogs";
import { fromUnixTime } from "date-fns";
import { StackNavigationProp } from "@react-navigation/stack";

import { SettingsStackParamList } from "./index";
import Content from "../../components/Content";
import { useStoreActions, useStoreState } from "../../state/store";
import { LoginMethods } from "../../state/Security";
import { BitcoinUnits, IBitcoinUnits } from "../../utils/bitcoin-units";
import { verifyChanBackup } from "../../lndmobile/channel";
import { camelCaseToSpace, formatISO, toast } from "../../utils";
import { MapStyle } from "../../utils/google-maps";
import { OnchainExplorer } from "../../state/Settings";
import TorSvg from "./TorSvg";
import { DEFAULT_DUNDER_SERVER, DEFAULT_INVOICE_EXPIRY, DEFAULT_NEUTRINO_NODE, PLATFORM } from "../../utils/constants";
import { IFiatRates } from "../../state/Fiat";
import KubbentWallet from "../../components/KubbentWallet";
import { Alert } from "../../utils/alert";
import { getNodeInfo } from "../../lndmobile";

import { useTranslation } from "react-i18next";
import { languages, namespaces } from "../../i18n/i18n.constants";
import { TouchableOpacity } from "react-native-gesture-handler";

let ReactNativePermissions: any;
if (PLATFORM !== "macos") {
  ReactNativePermissions = require("react-native-permissions");
}

interface ISettingsProps {
  navigation: StackNavigationProp<SettingsStackParamList, "Settings">;
}
export default function Settings({ navigation }: ISettingsProps) {
  const currentLanguage = useStoreState((store) => store.settings.language);
  const { t, i18n } = useTranslation(namespaces.settings.settings);
  const lndChainBackend = useStoreState((store) => store.settings.lndChainBackend);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: t("title"),
      headerBackTitle: "Back",
      headerShown: false,
    });
  }, [navigation, currentLanguage]);

  const onboardingState = useStoreState((store) => store.onboardingState);
  const rpcReady = useStoreState((store) => store.lightning.rpcReady);
  const isRecoverMode = useStoreState((store) => store.lightning.isRecoverMode);

  // Pincode
  const loginMethods = useStoreState((store) => store.security.loginMethods);
  const onRemovePincodePress = () => navigation.navigate("RemovePincodeAuth");
  const onSetPincodePress = () => navigation.navigate("SetPincode");

  // Fingerprint
  const fingerprintAvailable = useStoreState((store) => store.security.fingerprintAvailable);
  const fingerPrintEnabled = useStoreState((store) => store.security.fingerprintEnabled);
  const biometricsSensor = useStoreState((store) => store.security.sensor);
  const onToggleFingerprintPress = async () => {
    navigation.navigate("ChangeFingerprintSettingsAuth");
  }

  // Seed
  const seedAvailable = useStoreState((store) => store.security.seedAvailable);
  const getSeed = useStoreActions((store) => store.security.getSeed);
  const deleteSeedFromDevice = useStoreActions((store) => store.security.deleteSeedFromDevice);

  const onGetSeedPress = async () => {
    const seed = await getSeed()
    if (seed) {
      Alert.alert(t("wallet.seed.show.dialog.title"), seed.join(" "), [{
        text: t("wallet.seed.show.dialog.copy"),
        onPress: async () => {
          Clipboard.setString(seed.join(" "));
          toast(t("wallet.seed.show.dialog.alert"), undefined, "warning");
        }
      }, {
        text: t("buttons.ok",{ns:namespaces.common}),
      }]);
    }
  }

  const onRemoveSeedPress = async () => {
    Alert.alert(t("wallet.seed.remove.dialog.title"), t("wallet.seed.remove.dialog.msg"), [{
      text: t("buttons.cancel",{ns:namespaces.common}),
    }, {
      text: t("wallet.seed.remove.dialog.accept"),
      onPress: async () => await deleteSeedFromDevice(),
    }]);
  }

  // Bitcoin unit
  const currentBitcoinUnit = useStoreState((store) => store.settings.bitcoinUnit);
  const changeBitcoinUnit = useStoreActions((store) => store.settings.changeBitcoinUnit);
  const onBitcoinUnitPress = async () => {
    if (PLATFORM === "android") {
      const { selectedItem } = await DialogAndroid.showPicker(null, null, {
        positiveText: null,
        negativeText: t("buttons.cancel",{ns:namespaces.common}),
        type: DialogAndroid.listRadio,
        selectedId: currentBitcoinUnit,
        items: [
          { label: BitcoinUnits.bitcoin.settings, id: "bitcoin" },
          { label: BitcoinUnits.bit.settings, id: "bit" },
          { label: BitcoinUnits.sat.settings, id: "sat" },
          { label: BitcoinUnits.satoshi.settings, id: "satoshi" },
          { label: BitcoinUnits.milliBitcoin.settings, id: "milliBitcoin" },
        ]
      });
      if (selectedItem) {
        changeBitcoinUnit(selectedItem.id);
      }
    } else {
      navigation.navigate("ChangeBitcoinUnit", {
        title: t("display.bitcoinUnit.title"),
        data: [
          { title: BitcoinUnits.bitcoin.settings, value: "bitcoin" },
          { title: BitcoinUnits.bit.settings, value: "bit" },
          { title: BitcoinUnits.sat.settings, value: "sat" },
          { title: BitcoinUnits.satoshi.settings, value: "satoshi" },
          { title: BitcoinUnits.milliBitcoin.settings, value: "milliBitcoin" },
        ],
        onPick: async (currency) => await changeBitcoinUnit(currency as keyof IBitcoinUnits),
      });
    }
  }

  // Fiat unit
  const fiatRates = useStoreState((store) => store.fiat.fiatRates);
  const currentFiatUnit = useStoreState((store) => store.settings.fiatUnit);
  const changeFiatUnit = useStoreActions((store) => store.settings.changeFiatUnit);
  const onFiatUnitPress = async () => {
    if (PLATFORM === "android") {
      const { selectedItem } = await DialogAndroid.showPicker(null, null, {
        positiveText: null,
        negativeText: t("buttons.cancel",{ns:namespaces.common}),
        type: DialogAndroid.listRadio,
        selectedId: currentFiatUnit,
        items: Object.entries(fiatRates).map(([currency]) => {
          return {
            label: currency, id: currency
          }
        })
      });
      if (selectedItem) {
        changeFiatUnit(selectedItem.id);
      }
    } else {
      navigation.navigate("ChangeFiatUnit", {
        title: t("display.fiatUnit.title"),
        data: Object.entries(fiatRates).map(([currency]) => ({
          title: currency,
          value: currency as keyof IFiatRates,
        })),
        onPick: async (currency) => await changeFiatUnit(currency as keyof IFiatRates),
        searchEnabled: true,
      });
    }
  }

  // Name
  const name = useStoreState((store) => store.settings.name);
  const changeName = useStoreActions((store) => store.settings.changeName);
  const onNamePress = async () => {
    Alert.prompt(
      t("general.name.title"),
      t("general.name.dialog.msg"),
      [{
        text: t("buttons.cancel",{ns:namespaces.common}),
        style: "cancel",
        onPress: () => {},
      }, {
        text: t("general.name.dialog.accept"),
        onPress: async (text) => {
          await changeName(text ?? null);
        },
      }],
      "plain-text",
      name ?? "",
    );
  };

  // Language
  const changeLanguage = useStoreActions((store) => store.settings.changeLanguage);

  const onLangPress = async () => {
    if (PLATFORM === "android") {
      const { selectedItem } = await DialogAndroid.showPicker(null, null, {
        positiveText: null,
        negativeText: t("buttons.cancel",{ns:namespaces.common}),
        type: DialogAndroid.listRadio,
        selectedId: currentLanguage,
        items: Object.keys(languages).map((key)=>{
          return {label:languages[key].name,id:languages[key].id}
        })
      });
      if (selectedItem) {
        await changeLanguage(selectedItem.id);
      }
    } else {
      navigation.navigate("ChangeLanguage", {
        title: t("general.lang.dialog.title"),
        data: Object.keys(languages).map((key)=>{
          return { title: languages[key].name, value: languages[key].id }
        }),
        onPick: async (lang) => {
          await changeLanguage(lang);
        },
      });
    }
  };

  // Autopilot
  const autopilotEnabled = useStoreState((store) => store.settings.autopilotEnabled);
  const changeAutopilotEnabled = useStoreActions((store) => store.settings.changeAutopilotEnabled);
  const setupAutopilot = useStoreActions((store) => store.lightning.setupAutopilot);
  const onToggleAutopilotPress = () => { // TODO why not await?
    if (!rpcReady) {
      return;
    }
    changeAutopilotEnabled(!autopilotEnabled);
    setupAutopilot(!autopilotEnabled);
  }

  // Push Notifications
  const pushNotificationsEnabled = useStoreState((store) => store.settings.pushNotificationsEnabled);
  const changePushNotificationsEnabled = useStoreActions((store) => store.settings.changePushNotificationsEnabled);
  const onTogglePushNotificationsPress = async () => {
    await changePushNotificationsEnabled(!pushNotificationsEnabled);
  }

  // Clipboard invoice check
  const clipboardInvoiceCheckEnabled = useStoreState((store) => store.settings.clipboardInvoiceCheckEnabled);
  const changeClipboardInvoiceCheckEnabled = useStoreActions((store) => store.settings.changeClipboardInvoiceCheckEnabled);
  const checkInvoice = useStoreActions((store) => store.clipboardManager.checkInvoice);
  const onToggleClipBoardInvoiceCheck = async () => {
    await changeClipboardInvoiceCheckEnabled(!clipboardInvoiceCheckEnabled);
    if (!clipboardInvoiceCheckEnabled) {
      const clipboardText = await Clipboard.getString();
      await checkInvoice(clipboardText);
    }
  };

  // Copy App log
  const copyAppLog = async () => {
    try {
      const path = await NativeModules.LndMobileTools.saveLogs();
      toast(`${t("miscelaneous.appLog.dialog.alert")}: `+ path, 20000, "warning");
    } catch (e) {
      console.error(e);
      toast(t("miscelaneous.appLog.dialog.error"), undefined, "danger");
    }
  };

  // Copy lnd log
  const copyLndLog = async () => {
    try {
      await NativeModules.LndMobileTools.copyLndLog();
    } catch (e) {
      console.error(e);
      toast(t("miscelaneous.lndLog.dialog.error"), undefined, "danger");
    }
  };

  // Export channels
  const exportChannelsBackup = useStoreActions((store) => store.channel.exportChannelsBackup);
  const onExportChannelsPress = async () => {
    try {
      const response = await exportChannelsBackup();
    } catch (e) {
      console.log(e);
      toast(e.message, 10000, "danger");
    }
  }

  // Verify channels backup
  const onVerifyChannelsBackupPress = async () => {
    try {
      const res = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.allFiles],
      });
      const backupBase64 = await readFile(res.uri, "base64");
      await verifyChanBackup(backupBase64);
      Alert.alert("Channel backup file is valid");
    } catch (e) {
      console.log(e);
      if (!e.message?.includes?.("document picker")) {
        Alert.alert("Error verifying channel backup", e.message);
      }
    }
  }

  // Scheduled sync
  const workInfo = useStoreState((store) => store.scheduledSync.workInfo);
  const lastScheduledSync = useStoreState((store) => store.scheduledSync.lastScheduledSync);
  const lastScheduledSyncAttempt = useStoreState((store) => store.scheduledSync.lastScheduledSyncAttempt);

  const scheduledSyncEnabled = useStoreState((store) => store.settings.scheduledSyncEnabled);
  const changeScheduledSyncEnabled = useStoreActions((store) => store.settings.changeScheduledSyncEnabled);
  const setSyncEnabled = useStoreActions((store) => store.scheduledSync.setSyncEnabled);
  const onToggleScheduledSyncEnabled = async () => {
    if (scheduledSyncEnabled)
      Alert.alert(t("security.chainSync.dialog.title"),
                  t("security.chainSync.dialog.msg"),
      [{
        text: t("buttons.cancel", { ns:namespaces.common }),
      }, {
        text: "Proceed",
        onPress: async () => {
          await setSyncEnabled(!scheduledSyncEnabled);
          await changeScheduledSyncEnabled(!scheduledSyncEnabled);
        }
      }]);
    else {
      await setSyncEnabled(!scheduledSyncEnabled);
      await changeScheduledSyncEnabled(!scheduledSyncEnabled);
    }
  };
  const onLongPressScheduledSyncEnabled = async () => {
    toast(
      `${t("msg.status",{ns:namespaces.common})}: ${workInfo}\n`+
      `${t("msg.lastSyncAttempt",{ns:namespaces.common})}: ${formatISO(fromUnixTime(lastScheduledSyncAttempt))}\n` +
      `${t("msg.lastSync",{ns:namespaces.common})}: ${formatISO(fromUnixTime(lastScheduledSync))}`,
      0,
      "success",
      t("buttons.ok",{ns:namespaces.common}),
    )
  }

  // Debug show startup info
  const debugShowStartupInfo = useStoreState((store) => store.settings.debugShowStartupInfo);
  const changeDebugShowStartupInfo = useStoreActions((store) => store.settings.changeDebugShowStartupInfo);
  const onToggleDebugShowStartupInfo = async () => {
    await changeDebugShowStartupInfo(!debugShowStartupInfo);
  };

  const googleDriveBackupEnabled = useStoreState((store) => store.settings.googleDriveBackupEnabled);
  const changeGoogleDriveBackupEnabled = useStoreActions((store) => store.settings.changeGoogleDriveBackupEnabled);
  const googleSignIn = useStoreActions((store) => store.google.signIn);
  const googleSignOut = useStoreActions((store) => store.google.signOut);
  const googleIsSignedIn = useStoreState((store) => store.google.isSignedIn);
  const googleDriveMakeBackup = useStoreActions((store) => store.googleDriveBackup.makeBackup);
  const onToggleGoogleDriveBackup = async () => {
    if (!googleIsSignedIn) {
      await googleSignIn();
      await googleDriveMakeBackup();
      await changeGoogleDriveBackupEnabled(true);
      toast(t("wallet.backup.googleCloud.alert"));
    }
    else {
      await googleSignOut();
      await changeGoogleDriveBackupEnabled(false);
    }
  };

  const onDoGoogleDriveBackupPress = async () => {
    try {
      await googleDriveMakeBackup();
      toast(t("wallet.backup.googleCloudForce.alert"));
    }
    catch (e) {
      toast(t("wallet.backup.error")+`: ${e.message}`, 10000, "danger");
    }
  }

  const iCloudBackupEnabled = useStoreState((store) => store.settings.iCloudBackupEnabled);
  const changeICloudBackupEnabled = useStoreActions((store) => store.settings.changeICloudBackupEnabled);
  const iCloudMakeBackup = useStoreActions((store) => store.iCloudBackup.makeBackup);
  const onToggleICloudBackup = async () => {
      if (!iCloudBackupEnabled) {
        await iCloudMakeBackup();
      }
      await changeICloudBackupEnabled(!iCloudBackupEnabled);
      toast(`${t("wallet.backup.iCloud.alert")} ${iCloudBackupEnabled ? "disabled" : "enabled"}`);
  };

  const onDoICloudBackupPress = async () => {
    try {
      await iCloudMakeBackup();
      toast(t("wallet.backup.iCloudForce.alert"));
    }
    catch (e) {
      toast(t("wallet.backup.error")+`: ${e.message}`, 10000, "danger");
    }
  }

  // Transaction geolocation
  const transactionGeolocationEnabled = useStoreState((store) => store.settings.transactionGeolocationEnabled);
  const changeTransactionGeolocationEnabled = useStoreActions((store) => store.settings.changeTransactionGeolocationEnabled);
  const onToggleTransactionGeolocationEnabled = async () => {
    if (!transactionGeolocationEnabled) {
      try {
        if (PLATFORM === "android") {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          );
          console.log(granted);
          if (granted === PermissionsAndroid.RESULTS.GRANTED) {
            console.log(t("general.saveGeolocation.logGranted"));
          } else {
            console.log(t("general.saveGeolocation.logDenied"));
            return;
          }
        } else if (PLATFORM === "ios") {
          const r = await ReactNativePermissions.request(ReactNativePermissions.PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
          if (r !== "granted") {
            console.log(t("msg.error",{ns:namespaces.common})+": " + r);
          }
        }
      } catch (err:any) {
        console.warn(err);
      }
    }
    await changeTransactionGeolocationEnabled(!transactionGeolocationEnabled);
  };

  // Transaction geolocation map style
  const transactionGeolocationMapStyle = useStoreState((store) => store.settings.transactionGeolocationMapStyle);
  const changeTransactionGeolocationMapStyle = useStoreActions((store) => store.settings.changeTransactionGeolocationMapStyle);
  const onChangeMapStylePress = async () => {
    const { selectedItem } = await DialogAndroid.showPicker(null, null, {
      positiveText: null,
      negativeText: t("buttons.cancel", { ns:namespaces.common }),
      type: DialogAndroid.listRadio,
      selectedId: transactionGeolocationMapStyle,
      items: Object.keys(MapStyle).map((mapStyle) => ({
        id: mapStyle,
        label: camelCaseToSpace(mapStyle),
      }),
    )});

    if (selectedItem) {
      await changeTransactionGeolocationMapStyle(selectedItem.id);
    }
  };

  // Inbound services list
  const onInboundServiceListPress = async () => {
    const goToSite = async (selectedItem: "LNBIG" | "BITREFILL_THOR" | "ZFR") => {
      if (selectedItem === "LNBIG") {
        await Linking.openURL("https://lnbig.com/");
      } else if (selectedItem === "BITREFILL_THOR") {
        await Linking.openURL("https://embed.bitrefill.com/buy/lightning");
      } else if (selectedItem === "ZFR") {
        await Linking.openURL("https://zerofeerouting.com/mobile-wallets/");
      }
    };

    const description = `${t("LN.inbound.dialog.msg1")}

${t("LN.inbound.dialog.msg2")}

${t("LN.inbound.dialog.msg3")}`

    if (PLATFORM === "android") {
      interface ShowPickerResult {
        selectedItem: {
          id: "LNBIG" | "BITREFILL_THOR" | "ZFR";
          label: "LN Big" | "Bitrefill Thor" | "Zero Fee Routing";
        } | undefined;
      }
      const { selectedItem }: ShowPickerResult = await DialogAndroid.showPicker(null, null, {
        title: t("LN.inbound.dialog.title"),
        content: description,
        positiveText: t("buttons.continue", { ns:namespaces.common }),
        negativeText: t("buttons.cancel", { ns:namespaces.common }),
        type: DialogAndroid.listRadio,
        items: [{
          id: "LNBIG",
          label: "LN Big"
        }, {
          id: "BITREFILL_THOR",
          label: "Bitrefill Thor"
        }, {
          id: "ZFR",
          label: "Zero Fee Routing"
        }],
      });

      if (selectedItem) {
        await goToSite(selectedItem.id);
      }
    } else {
      navigation.navigate("ChannelProvider", {
        title: t("LN.inbound.dialog.title"),
        description,
        data: [{
          title: "LN Big",
          value: "LNBIG",
        }, {
          title: "Bitrefill Thor",
          value: "BITREFILL_THOR",
        }, {
          title: "Zero Fee Routing",
          value: "ZFR",
        }],
        onPick: async (selectedItem) => {
          goToSite(selectedItem as any)
        }
      });
    }
  }

  // Onchain explorer
  const onchainExplorer = useStoreState((store) => store.settings.onchainExplorer);
  const changeOnchainExplorer = useStoreActions((store) => store.settings.changeOnchainExplorer);
  const onChangeOnchainExplorerPress = async () => {
    const setCustomExplorer = async () => {
      const explorer = await Alert.promisePromptCallback(
        "Custom Onchain Explorer",
        "Set a custom onchain explorer (https://domain.com/)",
        undefined,
        onchainExplorer in OnchainExplorer ? undefined : onchainExplorer,
      );

      if (explorer.trim().length !== 0) {
        await changeOnchainExplorer(explorer);
      }
    };

    if (PLATFORM === "android") {
      const { selectedItem } = await DialogAndroid.showPicker(null, null, {
        positiveText: null,
        negativeText: t("buttons.cancel",{ns:namespaces.common}),
        type: DialogAndroid.listRadio,
        selectedId: onchainExplorer,
        items: Object.keys(OnchainExplorer).map((currOnchainExplorer) => ({
          id: currOnchainExplorer,
          label: camelCaseToSpace(currOnchainExplorer),
        })).concat(({
          id: "CUSTOM",
          label: "Custom explorer"
        }))
      });

      if (selectedItem) {
        if (selectedItem.id === "CUSTOM") {
          // Custom explorer, let's ask the user for a URL
          await setCustomExplorer();
        } else {
          await changeOnchainExplorer(selectedItem.id);
        }
      }
    } else {
      navigation.navigate("ChangeOnchainExplorer", {
        title: t("display.onchainExplorer.dialog.title"),
        data: Object.keys(OnchainExplorer).map((currOnchainExplorer) => ({
          title: camelCaseToSpace(currOnchainExplorer),
          value: currOnchainExplorer,
        })).concat({
          title: "Custom explorer",
          value: "CUSTOM"
        }),
        onPick: async (onchainExplorer) => {
          if (onchainExplorer === "CUSTOM") {
            // Custom explorer, let's ask the user for a URL
            await setCustomExplorer();
          } else {
            await changeOnchainExplorer(onchainExplorer);
          }
        },
      });
    }
  };

  // Neutrino peers
  const neutrinoPeers = useStoreState((store) => store.settings.neutrinoPeers);
  const changeNeutrinoPeers = useStoreActions((store) => store.settings.changeNeutrinoPeers);
  const writeConfig = useStoreActions((store) => store.writeConfig);
  const restartNeeded = () => {
    const title = t("bitcoinNetwork.restartDialog.title");
    const message = t("bitcoinNetwork.restartDialog.msg");
    if (PLATFORM === "android") {
      Alert.alert(
        title,
        message + "\n" + t("bitcoinNetwork.restartDialog.msg1"),
        [{
          style: "cancel",
          text: t("buttons.no",{ns:namespaces.common}),
        }, {
          style: "default",
          text: t("buttons.yes",{ns:namespaces.common}),
          onPress: async () => {
            try {
              await NativeModules.LndMobile.stopLnd();
              await NativeModules.LndMobileTools.killLnd();
            } catch(e) {
              console.log(e);
            }
            NativeModules.LndMobileTools.restartApp();
          }
        }]
      );
    } else {
      Alert.alert(title, message);
    }
  };
  const onSetBitcoinNodePress = async () => {
    Alert.prompt(
      t("bitcoinNetwork.node.setDialog.title"),
      t("bitcoinNetwork.node.setDialog.info") + "\n\n" +
      t("bitcoinNetwork.node.setDialog.leaveBlankToSearch") + "\n\n" +
      t("bitcoinNetwork.node.setDialog.longPressToReset", { defaultNode: DEFAULT_NEUTRINO_NODE }),
      [{
        text: t("buttons.cancel",{ns:namespaces.common}),
        style: "cancel",
        onPress: () => {},
      }, {
        text: t("bitcoinNetwork.node.setDialog.title"),
        onPress: async (text) => {
          if (text === neutrinoPeers[0]) {
            return;
          }

          if (text) {
            await changeNeutrinoPeers([text]);
          } else {
            await changeNeutrinoPeers([]);
          }
          await writeConfig();

          restartNeeded();
        },
      }],
      "plain-text",
      neutrinoPeers[0] ?? "",
    );
  };
  const onSetBitcoinNodeLongPress = async () => {
    Alert.alert(
      t("bitcoinNetwork.node.restoreDialog.title"),
      `${t("bitcoinNetwork.node.restoreDialog.msg")} (${DEFAULT_NEUTRINO_NODE})?`,
      [{
        style: "cancel",
        text: t("buttons.no",{ns:namespaces.common}),
      }, {
        style: "default",
        text: t("buttons.yes",{ns:namespaces.common}),
        onPress: async () => {
          await changeNeutrinoPeers([DEFAULT_NEUTRINO_NODE]);
          await writeConfig();
          restartNeeded();
        },
      }]
    );
  };

  // bitcoind RPC host
  const bitcoindRpcHost = useStoreState((store) => store.settings.bitcoindRpcHost);
  const changeBitcoindRpcHost = useStoreActions((store) => store.settings.changeBitcoindRpcHost);
  const onSetBitcoindRpcHostPress = async () => {
    Alert.prompt(
      t("bitcoinNetwork.rpc.title"),
      "",
      [{
        text: t("buttons.cancel", { ns:namespaces.common }),
        style: "cancel",
        onPress: () => {},
      }, {
        text: t("buttons.save", { ns:namespaces.common }),
        onPress: async (text) => {
          if (text) {
            await changeBitcoindRpcHost(text);
            await writeConfig();
          }
        },
      }],
      "plain-text",
      bitcoindRpcHost ?? "",
    );
  };

  // bitcoind zmq block
  const bitcoindPubRawBlock = useStoreState((store) => store.settings.bitcoindPubRawBlock);
  const changeBitcoindPubRawBlock = useStoreActions((store) => store.settings.changeBitcoindPubRawBlock);
  const onSetBitcoindPubRawBlockPress = async () => {
    Alert.prompt(
      t("bitcoinNetwork.zmqRawBlock.title"),
      "",
      [{
        text: t("buttons.cancel", { ns:namespaces.common }),
        style: "cancel",
        onPress: () => {},
      }, {
        text: t("buttons.save", { ns:namespaces.common }),
        onPress: async (text) => {
          if (text) {
            await changeBitcoindPubRawBlock(text);
            await writeConfig();
          }
        },
      }],
      "plain-text",
      bitcoindPubRawBlock ?? "",
    );
  };

  // bitcoind zmq tx
  const bitcoindPubRawTx = useStoreState((store) => store.settings.bitcoindPubRawTx);
  const changeBitcoindPubRawTx = useStoreActions((store) => store.settings.changeBitcoindPubRawTx);
  const onSetBitcoindPubRawTxPress = async () => {
    Alert.prompt(
      t("bitcoinNetwork.zmqRawTx.title"),
      "",
      [{
        text: t("buttons.cancel", { ns:namespaces.common }),
        style: "cancel",
        onPress: () => {},
      }, {
        text: t("buttons.save", { ns:namespaces.common }),
        onPress: async (text) => {
          if (text) {
            await changeBitcoindPubRawTx(text);
            await writeConfig();
          }
        },
      }],
      "plain-text",
      bitcoindPubRawTx ?? "",
    );
  };

  // Multi-path payments
  const multiPathPaymentsEnabled = useStoreState((store) => store.settings.multiPathPaymentsEnabled);
  const changeMultiPathPaymentsEnabled = useStoreActions((store) => store.settings.changeMultiPathPaymentsEnabled);
  const onChangeMultiPartPaymentEnabledPress = async () => {
    await changeMultiPathPaymentsEnabled(!multiPathPaymentsEnabled);
  };

  const torEnabled = useStoreState((store) => store.settings.torEnabled);
  const changeTorEnabled = useStoreActions((store) => store.settings.changeTorEnabled);
  const onChangeTorEnabled = async () => {
    const text = !torEnabled ?
`${t("experimental.tor.enabled.msg1")}

${t("experimental.tor.enabled.msg2")}

${t("experimental.tor.enabled.msg3")}:

https://blockchain.info/ticker
${t("experimental.tor.enabled.msg4")}

https://mempool.space/api/blocks/tip/height
${t("experimental.tor.enabled.msg5")}

https://www.googleapis.com/drive/v3/files
https://www.googleapis.com/upload/drive/v3/files
${t("experimental.tor.enabled.msg6")}

https://nodes.lightning.computer/availability/v1/btc.json
${t("experimental.tor.enabled.msg7")}

${t("experimental.tor.enabled.msg8")}`
:
`${t("experimental.tor.disabled.msg1")}
${t("experimental.tor.disabled.msg2")}`;

    Alert.alert(
      "Tor",
      text,
      [{ text: t("buttons.no",{ns:namespaces.common}) },
      {
        text: t("buttons.yes",{ns:namespaces.common}),
        onPress: async () => {
          await changeTorEnabled(!torEnabled);
          if (PLATFORM === "android") {
            try {
              await NativeModules.LndMobile.stopLnd();
              await NativeModules.LndMobileTools.killLnd();
            } catch(e) {
              console.log(e);
            }
            NativeModules.LndMobileTools.restartApp();
          } else {
            Alert.alert(
              t("bitcoinNetwork.restartDialog.title"),
              t("bitcoinNetwork.restartDialog.msg"),
            );
          }
        },
      }
    ]);
  };

  const hideExpiredInvoices = useStoreState((store) => store.settings.hideExpiredInvoices);
  const changeHideExpiredInvoices = useStoreActions((store) => store.settings.changeHideExpiredInvoices);
  const onToggleHideExpiredInvoicesPress = async () => {
    await changeHideExpiredInvoices(!hideExpiredInvoices);
  }

  const onShowOnionAddressPress = async () => {
    navigation.navigate("TorShowOnionAddress");
  }

  const screenTransitionsEnabled = useStoreState((store) => store.settings.screenTransitionsEnabled);
  const changeScreenTransitionsEnabled = useStoreActions((store) => store.settings.changeScreenTransitionsEnabled);
  const onToggleScreenTransitionsEnabledPress = async () => {
    await changeScreenTransitionsEnabled(!screenTransitionsEnabled);
  }

  const signMessage = useStoreActions((store) => store.lightning.signMessage);
  const onPressSignMesseage = async () => {
    Alert.prompt(
      t("miscelaneous.signMessage.dialog1.title"),
      undefined,
      async (text) => {
        if (text.length === 0) {
          return;
        }
        const signMessageResponse = await signMessage(text);

        Alert.alert(
          t("miscelaneous.signMessage.dialog2.title"),
          signMessageResponse.signature,
          [{
            text: t("buttons.ok", { ns:namespaces.common }),
          }, {
            text: t("buttons.copy", { ns:namespaces.common }),
            onPress: async () => {
              Clipboard.setString(signMessageResponse.signature);
              toast(t("miscelaneous.signMessage.dialog2.alert"), undefined, "warning");
            }
          }]
        );
      },
      "plain-text",
    );
  }

  // Delete wallet
  const onPressDeleteWallet = async () => {
    Alert.prompt(
      "Delete wallet",
      "WARNING!\nOnly do this if you're know what you're doing.\n" +
      "Any funds that has not been properly backed up will be lost forever.\n\n" +
      "Write \"delete wallet\" and press OK to continue.\n" +
      "Once the wallet has been deleted, the app will be restarted " +
      "for you to create restore or create a new wallet",
      async (text) => {
        if (text.length === 0 || text !== "delete wallet") {
          return;
        }

        if (text === "delete wallet") {
          // await NativeModules.LndMobile.stopLnd();
          // await timeout(1000);
          // await NativeModules.LndMobileTools.DEBUG_deleteDatafolder();
        }
      },
      "plain-text",
    );
  }

  // Dunder server
  const dunderServer = useStoreState((store) => store.settings.dunderServer);
  const changeDunderServer = useStoreActions((store) => store.settings.changeDunderServer);

  const onSetDunderServerPress = async () => {
    Alert.prompt(
      t("LN.LSP.setDialog.title"),
      "",
      [{
        text: t("buttons.cancel",{ ns:namespaces.common }),
        style: "cancel",
        onPress: () => {},
      }, {
        text: t("LN.LSP.setDialog.acept"),
        onPress: async (text) => {
          if (text === dunderServer) {
            return;
          }

          await changeDunderServer(text ?? "");
        },
      }],
      "plain-text",
      dunderServer ?? "",
    );
  };
  const onSetDunderServerLongPress = async () => {
    Alert.alert(
      t("LN.LSP.restoreDialog.title"),
      `${t("LN.LSP.restoreDialog.msg")} (${DEFAULT_DUNDER_SERVER})?`,
      [{
        style: "cancel",
        text: t("buttons.no", { ns:namespaces.common }),
      }, {
        style: "default",
        text: t("buttons.yes", { ns:namespaces.common }),
        onPress: async () => {
          await changeDunderServer(DEFAULT_DUNDER_SERVER);
        },
      }]
    );
  };

  // Enable Dunder LSP
  const dunderEnabled = useStoreState((store) => store.settings.dunderEnabled);
  const changeDunderEnabled = useStoreActions((store) => store.settings.changeDunderEnabled);
  const onToggleDunderEnabled = async () => {
    await changeDunderEnabled(!dunderEnabled);
  };

  // Enable Receive by P2TR
  const receiveViaP2TR = useStoreState((store) => store.settings.receiveViaP2TR);
  const changeReceiveViaP2TR = useStoreActions((store) => store.settings.changeReceiveViaP2TR);
  const onToggleReceiveViaP2TR = async () => {
    await changeReceiveViaP2TR(!receiveViaP2TR);
  };

  // Require graph sync before paying
  const requireGraphSync = useStoreState((store) => store.settings.requireGraphSync);
  const changeRequireGraphSync = useStoreActions((store) => store.settings.changeRequireGraphSync);
  const onToggleRequireGraphSyncPress = async () => {
    await changeRequireGraphSync(!requireGraphSync);
  };

  const onLndMobileHelpCenterPress = async () => {
    navigation.navigate("LndMobileHelpCenter");
  }

  const onGetNodeInfoPress = async () => {
    Alert.prompt(
      "Get node info",
      "Enter Node ID",
      [{
        text: "Cancel",
        style: "cancel",
        onPress: () => {},
      }, {
        text: "Get info",
        onPress: async (text) => {
          if (text === "") {
            return;
          }
          try {
            const nodeInfo = await getNodeInfo((text ?? "").split("@")[0], true);
            Alert.alert("", JSON.stringify(nodeInfo.toJSON(), null, 2));
          } catch (e) {
            Alert.alert(e.message);
          }
        },
      }],
      "plain-text",
    );
  };

  // Lnd Graph Cache
  const lndNoGraphCache = useStoreState((store) => store.settings.lndNoGraphCache);
  const changeLndNoGraphCache = useStoreActions((store) => store.settings.changeLndNoGraphCache);
  const onToggleLndNoGraphCache = async () => {
    await changeLndNoGraphCache(!lndNoGraphCache);
  };

  // Invoice expiry
  const invoiceExpiry = useStoreState((store) => store.settings.invoiceExpiry);
  const changeInvoiceExpiry = useStoreActions((store) => store.settings.changeInvoiceExpiry);
  const onPressSetInvoiceExpiry = async () => {
    const expiryString = await Alert.promisePromptCallback(
      "Set invoice expiry in seconds",
      "",
      "plain-text",
      invoiceExpiry.toString(),
      "number-pad"
    );

    try {
      const expiryNumber = Number.parseInt(expiryString, 10);
      await changeInvoiceExpiry(expiryNumber);
    } catch (e) {
      Alert.alert("", "Could not update expiry.\n"+ e.message);
    }
  }

  const onLongPressSetInvoiceExpiry = async () => {
    Alert.alert(
      "",
      `Would you like to restore the invoice expiry to the default value (${DEFAULT_INVOICE_EXPIRY} seconds)?`,
      [{
        style: "cancel",
        text: "No",
      }, {
        style: "default",
        text: "Yes",
        onPress: async () => {
          await changeInvoiceExpiry(DEFAULT_INVOICE_EXPIRY);
        },
      }]
    );
  };

  // Rescan wallet
  const changeRescanWallet = useStoreActions((store) => store.settings.changeRescanWallet);
  const onPressRescanWallet = async () => {
    await changeRescanWallet(true);
    restartNeeded();
  };
  // Setup demo environment
  const setupDemo = useStoreActions((store) => store.setupDemo);

  return (
    // <Container>
    //   <Content style={{ margin: 32, flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center' }}>
    //     <View>
    //       <Text style={{fontFamily: 'Sora-Regular', fontSize: 32}}>Kubbent Wallet</Text>
    //       <Text style={{fontFamily: 'Sora-ExtraLight', fontSize: 16, textAlign: 'center'}}>Version 0.1.0</Text>
    //     </View>
    //     <View>
    //       <Text style={{fontFamily: 'Sora-Regular', fontSize: 32}}>Kubbent Wallet</Text>
    //       <Text style={{fontFamily: 'Sora-ExtraLight', fontSize: 16, textAlign: 'center'}}>Version 0.1.0</Text>
    //     </View>
    //   </Content>
    // </Container>
    <Container style={{padding: 32, justifyContent: 'space-between'}}>
      <View style={{alignItems: 'center', marginBottom: 32, marginTop: 32}}>
        <Text style={{fontFamily: 'Sora-Regular', fontSize: 32}}>Kubbent Wallet</Text>
        <Text style={{fontFamily: 'Sora-ExtraLight', fontSize: 16, textAlign: 'center'}}>Version 0.1.0</Text>
      </View>
      <ScrollView>
        <View style={{alignItems: 'flex-start'}}>
          <Text style={{fontFamily: 'Sora-ExtraLight', marginBottom: 14,  fontSize: 22}}>General</Text>
          <TouchableOpacity onPress={onNamePress} style={{ marginBottom: 12, flexDirection: 'row', width: '100%', alignItems: 'center'}}>
            <Icon style={style.icon} type="Feather" name="user"/>
            <View>
              <Text style={{fontFamily: 'Sora-Regular'}}>{t("general.name.title")}</Text>
              <Text style={{fontFamily: 'Sora-ExtraLight'}} note={true}>
                {name || t("general.name.subtitle")}
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={onTogglePushNotificationsPress} style={{ marginBottom: 12, flexDirection: 'row', width: '100%', alignItems: 'center'}}>
            <Icon style={style.icon} type="Feather" name="bell"/>
            <View>
              <Text style={{fontFamily: 'Sora-Regular'}}>{t("general.pushNotification.title")}</Text>
              <Text style={{fontFamily: 'Sora-ExtraLight'}} note={true}>{t("general.pushNotification.subtitle")}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={{ marginBottom: 24, flexDirection: 'row', width: '100%', alignItems: 'center'}} onPress={onToggleClipBoardInvoiceCheck}>
            <Icon style={style.icon} type="Feather" name="clipboard"/>
            <View style={{flexDirection: 'row', width: '100%', alignContent: 'center', alignItems: 'center', alignSelf: 'center'}}>
              <Text style={{fontFamily: 'Sora-Regular'}}>{t("general.checkClipboard.title")}</Text>
              {/* <Text style={{fontFamily: 'Sora-ExtraLight'}} note={true}>{t("general.checkClipboard.subtitle")}</Text> */}
              <View>
                <CheckBox checked={clipboardInvoiceCheckEnabled} onPress={onToggleClipBoardInvoiceCheck} />
              </View>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={onToggleTransactionGeolocationEnabled} style={{ marginBottom: 24, flexDirection: 'row', width: '100%', alignItems: 'center'}}>
            <Icon style={style.icon} type="Feather" name="map-pin"/>
            <View style={{flexDirection: 'row', width: '100%', alignContent: 'center', alignItems: 'center', alignSelf: 'center'}}>
              <Text style={{fontFamily: 'Sora-Regular'}}>{t("general.saveGeolocation.title")}</Text>
              {/* <Text style={{fontFamily: 'Sora-ExtraLight'}} note={true}>{t("general.checkClipboard.subtitle")}</Text> */}
              <View>
                <CheckBox checked={transactionGeolocationEnabled} onPress={onToggleTransactionGeolocationEnabled} />
              </View>
            </View>
          </TouchableOpacity>
          <View style={{marginTop: 32}}>
            <Text style={{fontFamily: 'Sora-ExtraLight', marginBottom: 14,  fontSize: 22}}>Wallet</Text>
            {seedAvailable &&
              <TouchableOpacity onPress={onGetSeedPress} style={{ marginBottom: 12, flexDirection: 'row', width: '100%', alignItems: 'center'}}>
                <Icon style={style.icon} type="Feather" name="edit"/>
                <View>
                  <Text style={{fontFamily: 'Sora-Regular'}}>{t("wallet.seed.show.title")}</Text>
                  <Text style={{fontFamily: 'Sora-ExtraLight'}} note={true}>
                    {t("wallet.seed.show.subtitle")}
                  </Text>
                </View>
              </TouchableOpacity>
            }
            <TouchableOpacity onPress={onExportChannelsPress} style={{ marginBottom: 24, flexDirection: 'row', width: '100%', alignItems: 'center'}}>
              <Icon style={style.icon} type="Feather" name="save"/>
              <View>
                <Text style={{fontFamily: 'Sora-Regular'}}>{t("wallet.backup.export.title")}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={onVerifyChannelsBackupPress} style={{ marginBottom: 24, flexDirection: 'row', width: '100%', alignItems: 'center'}}>
              <Icon style={style.icon} type="Feather" name="upload-cloud"/>
              <View>
                <Text style={{fontFamily: 'Sora-Regular'}}>{t("wallet.backup.verify.title")}</Text>
              </View>
            </TouchableOpacity>
          </View>
          <View style={{marginTop: 32}}>
            <Text style={{fontFamily: 'Sora-ExtraLight', marginBottom: 14,  fontSize: 22}}>Security</Text>
            <TouchableOpacity onPress={loginMethods!.has(LoginMethods.pincode) ? onRemovePincodePress : onSetPincodePress} style={{ marginBottom: 24, flexDirection: 'row', width: '100%', alignItems: 'center'}}>
              <Icon style={style.icon} type="Feather" name="lock"/>
              <View style={{flexDirection: 'row', width: '100%', alignContent: 'center', alignItems: 'center', alignSelf: 'center'}}>
                <Text style={{fontFamily: 'Sora-Regular'}}>{t("security.pincode.title")}</Text>
                {/* <Text style={{fontFamily: 'Sora-ExtraLight'}} note={true}>{t("general.checkClipboard.subtitle")}</Text> */}
                <View>
                  <CheckBox checked={loginMethods!.has(LoginMethods.pincode)} onPress={loginMethods!.has(LoginMethods.pincode) ? onRemovePincodePress : onSetPincodePress} />
                </View>
              </View>
            </TouchableOpacity>
            {fingerprintAvailable && 
              <TouchableOpacity onPress={onToggleFingerprintPress} style={{ marginBottom: 24, flexDirection: 'row', width: '100%', alignItems: 'center'}}>
                {biometricsSensor !== "Face ID" &&
                  <Icon style={style.icon} type="Entypo" name="fingerprint" />
                }
                {biometricsSensor === "Face ID" &&
                  <Icon style={style.icon} type="Feather" name="smile" />
                }
                <View style={{flexDirection: 'row', width: '100%', alignContent: 'center', alignItems: 'center', alignSelf: 'center'}}>
                  <Text style={{fontFamily: 'Sora-Regular'}}>
                    {t("security.biometrics.title")}{" "}
                    {biometricsSensor === "Biometrics" && t("security.biometrics.fingerprint")}
                    {biometricsSensor === "Face ID" && t("security.biometrics.faceId")}
                    {biometricsSensor === "Touch ID" && t("security.biometrics.touchID")}
                  </Text>
                  {/* <Text style={{fontFamily: 'Sora-ExtraLight'}} note={true}>{t("general.checkClipboard.subtitle")}</Text> */}
                  <View>
                    <CheckBox checked={fingerPrintEnabled} onPress={onToggleFingerprintPress} />
                  </View>
                </View>
              </TouchableOpacity>
            }
          </View>
          <View style={{marginTop: 32}}>
            <Text style={{fontFamily: 'Sora-ExtraLight', marginBottom: 14,  fontSize: 22}}>{t("display.title")}</Text>
            <TouchableOpacity onPress={onFiatUnitPress} style={{ marginBottom: 24, flexDirection: 'row', width: '100%', alignItems: 'center'}}>
              <Icon style={style.icon} type="Feather" name="dollar-sign"/>
              <View>
                <Text style={{fontFamily: 'Sora-Regular'}}>{t("display.fiatUnit.title")}</Text>
                <Text style={{fontFamily: 'Sora-ExtraLight'}} note={true} onPress={onFiatUnitPress}>{currentFiatUnit}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={onBitcoinUnitPress} style={{ marginBottom: 24, flexDirection: 'row', width: '100%', alignItems: 'center'}}>
              <Icon style={style.icon} type="FontAwesome5" name="btc" />
              <View>
                <Text style={{fontFamily: 'Sora-Regular'}}>{t("display.bitcoinUnit.title")}</Text>
                <Text style={{fontFamily: 'Sora-ExtraLight'}} note={true}  onPress={onBitcoinUnitPress}>{BitcoinUnits[currentBitcoinUnit].settings}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={onChangeOnchainExplorerPress} style={{ marginBottom: 24, flexDirection: 'row', width: '100%', alignItems: 'center'}}>
              <Icon style={style.icon} type="Feather" name="link" />
              <View>
                <Text style={{fontFamily: 'Sora-Regular'}}>{t("display.onchainExplorer.title")}</Text>
                <Text style={{fontFamily: 'Sora-ExtraLight'}} note={true}>{onchainExplorer in OnchainExplorer ? camelCaseToSpace(onchainExplorer) : onchainExplorer}</Text>
              </View>
            </TouchableOpacity>
          </View>
          <View style={{marginTop: 32}}>
            <Text style={{fontFamily: 'Sora-ExtraLight', marginBottom: 14,  fontSize: 22}}>{t("bitcoinNetwork.title")}</Text>
            {lndChainBackend == "neutrino" &&
              <TouchableOpacity onPress={onSetBitcoindRpcHostPress} style={{ marginBottom: 24, flexDirection: 'row', width: '100%', alignItems: 'center'}}>
                <Icon style={style.icon} type="MaterialCommunityIcons" name="router-network" />
                <View>
                  <Text style={{fontFamily: 'Sora-Regular'}}>{t("bitcoinNetwork.rpc.title")}</Text>
                </View>
              </TouchableOpacity>
            }
            {lndChainBackend == "bitcoindWithZmq" &&
              <>
                <TouchableOpacity onPress={onSetBitcoindRpcHostPress} style={{ marginBottom: 24, flexDirection: 'row', width: '100%', alignItems: 'center'}}>
                  <Icon style={style.icon} type="MaterialCommunityIcons" name="router-network" />
                  <View>
                    <Text style={{fontFamily: 'Sora-Regular'}}>{t("bitcoinNetwork.rpc.title")}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity onPress={onSetBitcoindPubRawBlockPress} style={{ marginBottom: 24, flexDirection: 'row', width: '100%', alignItems: 'center'}}>
                  <Icon style={style.icon} type="MaterialCommunityIcons" name="router-network" />
                  <View>
                    <Text style={{fontFamily: 'Sora-Regular'}}>{t("bitcoinNetwork.zmqRawBlock.title")}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity onPress={onSetBitcoindPubRawTxPress} style={{ marginBottom: 24, flexDirection: 'row', width: '100%', alignItems: 'center'}}>
                  <Icon style={style.icon} type="MaterialCommunityIcons" name="router-network" />
                  <View>
                    <Text style={{fontFamily: 'Sora-Regular'}}>{t("bitcoinNetwork.zmqRawTx.title")}</Text>
                  </View>
                </TouchableOpacity>
              </>
            }
            <TouchableOpacity style={{ marginBottom: 24, flexDirection: 'row', width: '100%', alignItems: 'center'}} onPress={onToggleReceiveViaP2TR}>
              <Icon style={style.icon} type="MaterialCommunityIcons" name="carrot" />
              <View style={{flexDirection: 'row', width: '100%', alignContent: 'center', alignItems: 'center', alignSelf: 'center'}}>
                <Text style={{fontFamily: 'Sora-Regular'}}>Receive from Taproot</Text>
                {/* <Text style={{fontFamily: 'Sora-ExtraLight'}} note={true}>{t("general.checkClipboard.subtitle")}</Text> */}
                <View>
                  <CheckBox checked={receiveViaP2TR} onPress={onToggleReceiveViaP2TR} />
                </View>
              </View>
            </TouchableOpacity>
          </View>
          <View style={{marginTop: 32}}>
            <Text style={{fontFamily: 'Sora-ExtraLight', marginBottom: 14,  fontSize: 22}}>{t("LN.title")}</Text>
            <TouchableOpacity onPress={() => navigation.navigate("LightningNodeInfo")} style={{ marginBottom: 24, flexDirection: 'row', width: '100%', alignItems: 'center'}}>
              <Icon style={style.icon} type="Feather" name="user" />
              <View>
                <Text style={{fontFamily: 'Sora-Regular'}}>{t("LN.node.title")}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate("LightningPeers")} style={{ marginBottom: 24, flexDirection: 'row', width: '100%', alignItems: 'center'}}>
              <Icon style={style.icon} type="Feather" name="users" />
              <View>
                <Text style={{fontFamily: 'Sora-Regular'}}>{t("LN.peers.title")}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={{ marginBottom: 24, flexDirection: 'row', width: '100%', alignItems: 'center'}} onPress={onToggleAutopilotPress}>
              <Icon style={style.icon} type="Feather" name="bar-chart" />
              <View style={{flexDirection: 'row', width: '100%', alignContent: 'center', alignItems: 'center', alignSelf: 'center'}}>
                <Text style={{fontFamily: 'Sora-Regular'}}>{t("LN.autopilot.title")}</Text>
                {/* <Text style={{fontFamily: 'Sora-ExtraLight'}} note={true}>{t("general.checkClipboard.subtitle")}</Text> */}
                <View>
                  <CheckBox checked={autopilotEnabled} onPress={onToggleAutopilotPress}  />
                </View>
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={onInboundServiceListPress} style={{ marginBottom: 24, flexDirection: 'row', width: '100%', alignItems: 'center'}}>
              <Icon style={style.icon} type="Feather" name="download-cloud" />
              <View>
                <Text style={{fontFamily: 'Sora-Regular'}}>{t("LN.inbound.title")}</Text>
                <Text style={{fontFamily: 'Sora-ExtraLight'}} note={true}>{t("LN.inbound.subtitle")}</Text>
              </View>
            </TouchableOpacity>
            {dunderEnabled && 
              <TouchableOpacity onPress={onInboundServiceListPress} style={{ marginBottom: 24, flexDirection: 'row', width: '100%', alignItems: 'center'}}>
                <Icon style={style.icon} type="Entypo" name="slideshare" />
                <View>
                  <Text style={{fontFamily: 'Sora-Regular'}}>{t("LN.LSP.title")}</Text>
                </View>
              </TouchableOpacity>
            }
            <TouchableOpacity style={{ marginBottom: 24, flexDirection: 'row', width: '100%', alignItems: 'center'}} onPress={onToggleRequireGraphSyncPress}>
              <Icon style={style.icon} type="Feather" name="refresh-cw" />
              <View style={{flexDirection: 'row', width: '100%', alignContent: 'center', alignItems: 'center', alignSelf: 'center'}}>
                <Text style={{fontFamily: 'Sora-Regular'}}>Wait for sync before paying</Text>
                {/* <Text style={{fontFamily: 'Sora-ExtraLight'}} note={true}>{t("LN.graphSync.subtitle")}</Text> */}
                <View>
                  <CheckBox checked={requireGraphSync} onPress={onToggleRequireGraphSyncPress} />
                </View>
              </View>
            </TouchableOpacity>
          </View>
          <View style={{marginTop: 32}}>
            <Text style={{fontFamily: 'Sora-ExtraLight', marginBottom: 14,  fontSize: 22}}>{t("miscelaneous.title")}</Text>
            {/* <TouchableOpacity onPress={() => navigation.navigate("About")} style={{ marginBottom: 24, flexDirection: 'row', width: '100%', alignItems: 'center'}}>
              <Icon style={style.icon} type="Feather" name="info" />
              <View>
                <Text style={{fontFamily: 'Sora-Regular'}}>{t("miscelaneous.about.title")}</Text>
              </View>
            </TouchableOpacity> */}
            {PLATFORM === "android" &&
              <TouchableOpacity onPress={() => copyAppLog()} style={{ marginBottom: 24, flexDirection: 'row', width: '100%', alignItems: 'center'}}>
                <Icon style={style.icon} type="Feather" name="copy" />
                <View>
                  <Text style={{fontFamily: 'Sora-Regular'}}>{t("miscelaneous.appLog.title")}</Text>
                </View>
              </TouchableOpacity>
            }
            {(PLATFORM === "android" || PLATFORM === "ios") &&
              <TouchableOpacity onPress={() => copyLndLog()} style={{ marginBottom: 24, flexDirection: 'row', width: '100%', alignItems: 'center'}}>
                <Icon style={style.icon} type="Feather" name="copy" />
                <View>
                  <Text style={{fontFamily: 'Sora-Regular'}}>{t("miscelaneous.lndLog.title")}</Text>
                </View>
              </TouchableOpacity>
            }
            <TouchableOpacity style={{ marginBottom: 24, flexDirection: 'row', width: '100%', alignItems: 'center'}} onPress={onToggleHideExpiredInvoicesPress}>
              <Icon style={style.icon} type="Feather" name="file" />
              <View style={{flexDirection: 'row', width: '100%', alignContent: 'center', alignItems: 'center', alignSelf: 'center'}}>
                <Text style={{fontFamily: 'Sora-Regular'}}>Hide expired invoices</Text>
                {/* <Text style={{fontFamily: 'Sora-ExtraLight'}} note={true}>{t("LN.graphSync.subtitle")}</Text> */}
                <View>
                  <CheckBox checked={hideExpiredInvoices} onPress={onToggleHideExpiredInvoicesPress} />
                </View>
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={onToggleScreenTransitionsEnabledPress} style={{ marginBottom: 24, flexDirection: 'row', width: '100%', alignItems: 'center'}}>
              <Icon style={style.icon} type="Feather" name="list" />
              <View style={{flexDirection: 'row', width: '100%', alignContent: 'center', alignItems: 'center', alignSelf: 'center'}}>
                <Text style={{fontFamily: 'Sora-Regular'}}>{t("miscelaneous.screenTransactions.title")}</Text>
                {/* <Text style={{fontFamily: 'Sora-ExtraLight'}} note={true}>{t("LN.graphSync.subtitle")}</Text> */}
                <View>
                  <CheckBox checked={screenTransitionsEnabled} onPress={onToggleScreenTransitionsEnabledPress} />
                </View>
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={onPressSignMesseage} style={{ marginBottom: 24, flexDirection: 'row', width: '100%', alignItems: 'center'}}>
              <Icon style={style.icon} type="Feather" name="file-text" />
              <View style={{flexDirection: 'row', width: '100%', alignContent: 'center', alignItems: 'center', alignSelf: 'center'}}>
                <Text style={{fontFamily: 'Sora-Regular'}}>{t("miscelaneous.signMessage.title")}</Text>
                {/* <Text style={{fontFamily: 'Sora-ExtraLight'}} note={true}>{t("LN.graphSync.subtitle")}</Text> */}
              </View>
            </TouchableOpacity>
          </View>
          <View style={{marginTop: 32}}>
            <Text style={{fontFamily: 'Sora-ExtraLight', marginBottom: 14,  fontSize: 22}}>{t("experimental.title")}</Text>
            <TouchableOpacity onPress={onToggleDunderEnabled} style={{ marginBottom: 24, flexDirection: 'row', width: '100%', alignItems: 'center'}}>
              <Icon style={style.icon} type="Feather" name="users" />
              <View style={{flexDirection: 'row', width: '100%', alignContent: 'center', alignItems: 'center', alignSelf: 'center'}}>
                <Text style={{fontFamily: 'Sora-Regular'}}>{t("experimental.LSP.title")}</Text>
                {/* <Text style={{fontFamily: 'Sora-ExtraLight'}} note={true}>{t("LN.graphSync.subtitle")}</Text> */}
                <View>
                  <CheckBox checked={dunderEnabled} onPress={onToggleDunderEnabled} />
                </View>
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={onChangeMultiPartPaymentEnabledPress} style={{ marginBottom: 24, flexDirection: 'row', width: '100%', alignItems: 'center'}}>
              <Icon style={style.icon} type="MaterialCommunityIcons" name="multiplication" />
              <View style={{flexDirection: 'row', width: '100%', alignContent: 'center', alignItems: 'center', alignSelf: 'center'}}>
                <Text style={{fontFamily: 'Sora-Regular'}}>{t("experimental.MPP.title")}</Text>
                {/* <Text style={{fontFamily: 'Sora-ExtraLight'}} note={true}>{t("LN.graphSync.subtitle")}</Text> */}
                <View>
                  <CheckBox checked={multiPathPaymentsEnabled} onPress={onChangeMultiPartPaymentEnabledPress} />
                </View>
              </View>
            </TouchableOpacity>
            {["android", "ios"].includes(PLATFORM) &&
              <TouchableOpacity onPress={onShowOnionAddressPress} style={{ marginBottom: 24, flexDirection: 'row', width: '100%', alignItems: 'center'}}>
                <Icon style={[style.icon, { marginLeft: 1, marginRight: 10}]} type="AntDesign" name="qrcode" />
                <View style={{flexDirection: 'row', width: '100%', alignContent: 'center', alignItems: 'center', alignSelf: 'center'}}>
                  <Text style={{fontFamily: 'Sora-Regular'}}>{t("experimental.onion.subtitle")}</Text>
                  {/* <Text style={{fontFamily: 'Sora-ExtraLight'}} note={true}>{t("LN.graphSync.subtitle")}</Text> */}
                </View>
              </TouchableOpacity>
            }
            <TouchableOpacity onPress={onPressSetInvoiceExpiry} onLongPress={onLongPressSetInvoiceExpiry} style={{ marginBottom: 24, flexDirection: 'row', width: '100%', alignItems: 'center'}}>
              <Icon style={style.icon} type="Feather" name="clock" />
              <View>
                <Text style={{fontFamily: 'Sora-Regular'}}>Invoice expiry (seconds)</Text>
                <Text style={{fontFamily: 'Sora-ExtraLight'}} note={true}>{invoiceExpiry} seconds</Text>
              </View>
            </TouchableOpacity>
          </View>
          <View>
            <Text style={{fontFamily: 'Sora-ExtraLight', marginBottom: 14,  fontSize: 22}}>{t("debug.title")}</Text>
            {(name === "Hampus" || __DEV__ === true) &&
              <TouchableOpacity onPress={() => navigation.navigate("DEV_CommandsX" as never)} style={{ marginBottom: 24, flexDirection: 'row', width: '100%', alignItems: 'center'}}>
                <Icon style={style.icon} type="Feather" name="terminal" />
                <View>
                  <Text style={{fontFamily: 'Sora-Regular'}}>{t("miscelaneous.dev.title")}</Text>
                </View>
              </TouchableOpacity>
            }
            <TouchableOpacity onPress={onToggleDebugShowStartupInfo} style={{ marginBottom: 24, flexDirection: 'row', width: '100%', alignItems: 'center'}}>
              <Icon style={style.icon} type="MaterialCommunityIcons" name="android-debug-bridge" />
              <View style={{flexDirection: 'row', width: '100%', alignContent: 'center', alignItems: 'center', alignSelf: 'center'}}>
                <Text style={{fontFamily: 'Sora-Regular'}}>{t("debug.startup.title")}</Text>
                {/* <Text style={{fontFamily: 'Sora-ExtraLight'}} note={true}>{t("LN.graphSync.subtitle")}</Text> */}
                <View>
                  <CheckBox checked={debugShowStartupInfo} onPress={onToggleDebugShowStartupInfo} />
                </View>
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={onPressRescanWallet} style={{ marginBottom: 24, flexDirection: 'row', width: '100%', alignItems: 'center'}}>
              <Icon style={style.icon} type="Feather" name="refresh-cw" />
              <View>
                <Text style={{fontFamily: 'Sora-Regular'}}>{t("debug.rescanWallet.title")}</Text>
                {/* <Text style={{fontFamily: 'Sora-ExtraLight'}} note={true}>{t("debug.rescanWallet.subtitle")}</Text> */}
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={onPressRescanWallet} style={{ marginBottom: 24, flexDirection: 'row', width: '100%', alignItems: 'center'}}>
              <Icon style={style.icon} type="Entypo" name="lifebuoy" />
              <View>
                <Text style={{fontFamily: 'Sora-Regular'}}>{t("debug.helpCencer.title")}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={onGetNodeInfoPress} style={{ marginBottom: 24, flexDirection: 'row', width: '100%', alignItems: 'center'}}>
              <Icon style={style.icon} type="Feather" name="info" />
              <View>
                <Text style={{fontFamily: 'Sora-Regular'}}>Get node info</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={onToggleLndNoGraphCache} style={{ marginBottom: 24, flexDirection: 'row', width: '100%', alignItems: 'center'}}>
              <Icon style={style.icon} type="Feather" name="refresh-ccw" />
              <View style={{flexDirection: 'row', width: '100%', alignContent: 'center', alignItems: 'center', alignSelf: 'center'}}>
                <Text style={{fontFamily: 'Sora-Regular'}}>Disable lnd graph cache</Text>
                {/* <Text style={{fontFamily: 'Sora-ExtraLight'}} note={true}>{t("LN.graphSync.subtitle")}</Text> */}
                <View>
                  <CheckBox checked={lndNoGraphCache} onPress={onToggleLndNoGraphCache} />
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      <Text style={{marginTop: 12, color: 'white', textAlign: 'center', fontFamily: 'Sora-Regular'}}>
        Scroll down for more.
      </Text>
    </Container>
  );
};

const style = StyleSheet.create({
  list: {
    paddingTop: 6,
    marginBottom: 48,
  },
  listItem: {
    paddingLeft: 2,
    paddingRight: 2,
    flexDirection: 'row',
    // paddingLeft: 24,
    // paddingRight: 24,
  },
  itemHeader: {
    paddingLeft: 8,
    paddingRight: 8,
    // paddingRight: 24,
    // paddingLeft: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 0,
  },
  icon: {
    fontSize: 22,
    marginRight: 15,
    ...Platform.select({
      web: {
        marginRight: 5,
      }
    }),
  },
});
